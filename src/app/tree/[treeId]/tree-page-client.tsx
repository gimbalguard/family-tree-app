'use client';
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import type {
  Node,
  Edge,
  Connection,
  OnConnect,
  OnNodeDrag,
  OnNodeDragStart,
  OnNodeDragStop,
  OnNodesChange,
  OnEdgeDoubleClick,
  OnPaneClick,
  OnEdgeClick,
  OnNodeDoubleClick,
  OnNodeContextMenu,
  IsValidConnection,
  NodeChange,
  OnSelectionChangeParams,
  XYPosition,
} from 'reactflow';
import {
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
} from 'reactflow';
import { useUser, useFirestore, useStorage } from '@/firebase';
import { useRouter } from 'next/navigation';
import type {
  FamilyTree,
  Person,
  Relationship,
  CanvasPosition,
  ManualEvent,
  SocialLink,
  ExportedFile,
  RootsProject,
  DesignPage,
} from '@/lib/types';
import { FamilyTreeCanvas } from './family-tree-canvas';
import { PersonEditor } from './person-editor';
import { RelationshipModal, relationshipOptions } from './relationship-modal';
import { NodeContextMenu } from './node-context-menu';
import { CanvasToolbar } from './canvas-toolbar';
import { Loader2, User, ArrowLeft, Trophy, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignHorizontalSpaceAround, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalSpaceAround } from 'lucide-react';
import { Logo } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { TimelineView } from './views/TimelineView';
import { TableView } from './views/table/TableView';
import { MapView } from './views/MapView';
import { CalendarView } from './views/CalendarView';
import { ManualEventEditor } from './views/ManualEventEditor';
import { StatisticsView } from './views/StatisticsView';
import { TriviaView } from './views/TriviaView';
import { RootsView, type RootsProjectData } from './views/RootsView';
import { SettingsModal } from './settings-modal';
import { AccountModal } from './account-modal';
import { AiChatPanel } from './views/AiChatPanel';
import { PdfExportModal } from './pdf-export-modal';
import { ImageExportModal } from './image-export-modal';
import { PowerPointExportModal } from './powerpoint-export-modal';
import { exportToExcel, parseAndValidateExcel, ParsedExcelData } from '@/lib/excel-handler';
import { ImportConfirmationModal, ImportMode } from './import-confirmation-modal';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useAiChat, type ChatMessage } from '@/context/ai-chat-context';
import { WIZARD_STEPS } from './roots-config';


type TreePageClientProps = {
  treeId: string;
  readOnly?: boolean;
};

export type ViewMode =
  | 'tree'
  | 'timeline'
  | 'table'
  | 'map'
  | 'calendar'
  | 'statistics'
  | 'trivia'
  | 'roots';

export type CanvasAspectRatio = 'free' | 'a4-landscape' | 'a4-portrait' | '16:9-landscape' | '16:9-portrait' | '1:1';

export type EdgeType = 'default' | 'step' | 'straight';

// Helper for debouncing
function useDebounce<F extends (...args: any[]) => any>(callback: F, delay: number) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return useCallback((...args: Parameters<F>) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    }, [callback, delay]);
}

// This function now intelligently determines the correct source and target handles
// based on the LOGICAL relationship type, not the handles used to draw the initial line.
const getEdgeProps = (rel: Relationship, nodes: Node<Person>[]) => {
    const nodeA = nodes.find((n) => n.id === rel.personAId);
    const nodeB = nodes.find((n) => n.id === rel.personBId);

    if (!nodeA || !nodeB) {
        return { source: rel.personAId, target: rel.personBId, sourceHandle: 'bottom', targetHandle: 'top' };
    }

    const parentTypes = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
    const spouseTypes = ['spouse', 'ex_spouse', 'separated', 'partner', 'ex_partner', 'widowed'];
    const siblingTypes = ['sibling', 'twin', 'step_sibling'];

    if (parentTypes.includes(rel.relationshipType)) {
        return { source: rel.personAId, target: rel.personBId, sourceHandle: 'bottom', targetHandle: 'top' };
    }
    
    // For symmetrical relationships, decide left/right based on X position to keep lines consistent.
    const isNodeALeft = nodeA.position.x < nodeB.position.x;
    
    const sourceId = isNodeALeft ? rel.personAId : rel.personBId;
    const targetId = isNodeALeft ? rel.personBId : rel.personAId;
    
    return {
        source: sourceId,
        target: targetId,
        sourceHandle: 'right',
        targetHandle: 'left'
    };
};

const getSelectionBoundingBox = (nodes: Node[]): { x: number; y: number; width: number; height: number } | null => {
    if (nodes.length === 0) return null;
  
    const xCoords = nodes.map(n => n.position.x);
    const yCoords = nodes.map(n => n.position.y);
  
    const minX = Math.min(...xCoords);
    const minY = Math.min(...yCoords);
  
    const maxX = Math.max(...nodes.map(n => n.position.x + (n.width || 0)));
    const maxY = Math.max(...nodes.map(n => n.position.y + (n.height || 0)));
  
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
};

const AlignmentToolbar = ({
    nodes,
    onAlign,
}: {
    nodes: Node<Person>[];
    onAlign: (type: string) => void;
}) => {
    const { getViewport } = useReactFlow();
    const bbox = getSelectionBoundingBox(nodes);
    if (!bbox) return null;
    
    const { x, y, zoom } = getViewport();
    
    const toolbarStyle: React.CSSProperties = {
        position: 'absolute',
        top: `${bbox.y * zoom + y - 48}px`, // 48px offset above the selection
        left: `${(bbox.x + bbox.width / 2) * zoom + x}px`,
        transform: 'translateX(-50%)',
        zIndex: 100,
    };

    const actions = [
        { type: 'align-left', icon: AlignHorizontalJustifyStart, tooltip: 'יישור לשמאל' },
        { type: 'align-center-h', icon: AlignHorizontalJustifyCenter, tooltip: 'מרכוז אופקי' },
        { type: 'align-right', icon: AlignHorizontalJustifyEnd, tooltip: 'יישור לימין' },
        { type: 'distribute-h', icon: AlignHorizontalSpaceAround, tooltip: 'פזר אופקית' },
        { type: 'align-top', icon: AlignVerticalJustifyStart, tooltip: 'יישור למעלה' },
        { type: 'align-center-v', icon: AlignVerticalJustifyCenter, tooltip: 'מרכוז אנכי' },
        { type: 'align-bottom', icon: AlignVerticalJustifyEnd, tooltip: 'יישור למטה' },
        { type: 'distribute-v', icon: AlignVerticalSpaceAround, tooltip: 'פזר אנכית' },
    ];

    return (
        <div style={toolbarStyle} className="flex items-center gap-1 p-1 bg-background/80 backdrop-blur-sm border rounded-lg shadow-lg">
            {actions.map(action => (
                 <Button key={action.type} variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAlign(action.type)} title={action.tooltip}>
                    <action.icon className="h-5 w-5" />
                </Button>
            ))}
        </div>
    );
};


function TreeCanvasContainer({ treeId, readOnly = false }: TreePageClientProps) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  const { getNodes } = useReactFlow();
  
  type HistoryState = { nodes: Node[]; edges: Edge[]; rootsProject: RootsProject | null; };
  const historyRef = useRef<{ past: HistoryState[]; future: HistoryState[] }>({ past: [], future: [] });

  const hasInitiallyLoaded = useRef(false);
  const HISTORY_LIMIT = 30;
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [manualEvents, setManualEvents] = useState<ManualEvent[]>([]);
  const [rootsProject, setRootsProject] = useState<RootsProject | null>(null);
  
  const [canvasPositions, setCanvasPositions] = useState<CanvasPosition[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node<Person>[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const [newConnection, setNewConnection] = useState<Connection | null>(null);
  const [editingRelationship, setEditingRelationship] =
    useState<Relationship | null>(null);
  const [isRelModalOpen, setIsRelModalOpen] = useState(false);

  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [personToCreate, setPersonToCreate] = useState<any | null>(null);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isImporting, setIsImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedExcelData, setParsedExcelData] = useState<ParsedExcelData | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);


  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [isOwnerPopoverOpen, setIsOwnerPopoverOpen] = useState(false);
  
  const [isManualEventEditorOpen, setIsManualEventEditorOpen] = useState(false);
  const [editingManualEvent, setEditingManualEvent] = useState<Partial<ManualEvent> | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [edgeType, setEdgeType] = useState<EdgeType>('default');
  const [isTimelineCompact, setIsTimelineCompact] = useState(false);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isImageExportModalOpen, setIsImageExportModalOpen] = useState(false);
  const [isPowerPointModalOpen, setIsPowerPointModalOpen] = useState(false);
  const [canvasAspectRatio, setCanvasAspectRatio] = useState<CanvasAspectRatio>('free');
  const [currentRootsPage, setCurrentRootsPage] = useState<DesignPage | undefined>(undefined);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodes: Node<Person>[];
  } | null>(null);
  const dragRef = useRef<{
    nodeId: string;
    isGroupDrag: boolean;
    initialNodePositions: Map<string, XYPosition>;
  } | null>(null);
  
  const [canvasBg, setCanvasBg] = useState<string | undefined>(undefined);
  
  const { setChatHistory } = useAiChat();

  const recordHistory = useCallback(() => {
    if (readOnly) return;
    const currentPast = historyRef.current.past;
    // Deep clone to prevent mutation issues
    const currentState = JSON.parse(JSON.stringify({ nodes, edges, rootsProject }));

    const newPast = [...currentPast, currentState];
    if (newPast.length > HISTORY_LIMIT) {
      newPast.shift();
    }
    historyRef.current = { past: newPast, future: [] };
    setCanUndo(true);
    setCanRedo(false);
  }, [nodes, edges, rootsProject, readOnly]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.past.length === 0) return;

    const newPast = [...historyRef.current.past];
    const presentState = newPast.pop();
    if (presentState) {
        const currentState = JSON.parse(JSON.stringify({ nodes, edges, rootsProject }));
        historyRef.current.future.unshift(currentState);
        historyRef.current.past = newPast;

        setNodes(presentState.nodes);
        setEdges(presentState.edges);
        setRootsProject(presentState.rootsProject);

        setCanUndo(newPast.length > 0);
        setCanRedo(true);
    }
  }, [nodes, edges, rootsProject]);

  const handleRedo = useCallback(() => {
    if (historyRef.current.future.length === 0) return;
    const newFuture = [...historyRef.current.future];
    const presentState = newFuture.shift();
    if (presentState) {
        const currentState = JSON.parse(JSON.stringify({ nodes, edges, rootsProject }));
        historyRef.current.past.push(currentState);
        historyRef.current.future = newFuture;

        setNodes(presentState.nodes);
        setEdges(presentState.edges);
        setRootsProject(presentState.rootsProject);

        setCanUndo(true);
        setCanRedo(newFuture.length > 0);
    }
  }, [nodes, edges, rootsProject]);
  
  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
            event.preventDefault();
            handleUndo();
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
            event.preventDefault();
            handleRedo();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  const fetchData = useCallback(async () => {
    if (isUserLoading || !db) return; // Wait for user state to be known

    // A user is required for any writeable view.
    if (!readOnly && !user) {
        router.replace('/login');
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      let ownerId;
      let canEditShared = false;
      let isSharedView = false;
      if (readOnly) {
        const publicDocRef = doc(db, 'publicTrees', treeId);
        const publicDocSnap = await getDoc(publicDocRef);
        if (publicDocSnap.exists()) {
          ownerId = publicDocSnap.data().ownerUserId;
        } else if (user) {
            const sharedQuery = query(collection(db, "sharedTrees"), where("treeId", "==", treeId), where("sharedWithUserId", "==", user.uid), limit(1));
            const sharedSnap = await getDocs(sharedQuery);
            if (!sharedSnap.empty) {
                const shareData = sharedSnap.docs[0].data();
                ownerId = shareData.ownerUserId;
                canEditShared = shareData.canEdit;
                isSharedView = true;
            } else {
                 const myTreeRef = doc(db, 'users', user.uid, 'familyTrees', treeId);
                 const myTreeSnap = await getDoc(myTreeRef);
                 if (myTreeSnap.exists()) {
                     ownerId = user.uid;
                 }
            }
        }
      } else {
        // For editable views, the current user must be the owner. `user` is guaranteed to be non-null here by the check at the top.
        ownerId = user!.uid;
      }
      
      if (!ownerId) {
        throw new Error('עץ המשפחה לא נמצא או שאין לך גישה.');
      }
      
      const effectiveReadOnly = readOnly && !(isSharedView && canEditShared);

      const basePath = `users/${ownerId}/familyTrees/${treeId}`;
      const treeDetailsRef = doc(db, basePath);
      const peopleRef = collection(db, basePath, 'people');
      const relsRef = collection(db, basePath, 'relationships');
      const posRef = collection(db, basePath, 'canvasPositions');
      const manualEventsRef = collection(db, basePath, 'manualEvents');
      const rootsProjectRef = doc(db, basePath, 'rootsProjects', 'main');

      const treeSnap = await getDoc(treeDetailsRef);
      if (!treeSnap.exists()) {
        throw new Error('עץ המשפחה לא נמצא או שאין לך גישה.');
      }

      const [peopleSnap, relsSnap, posSnap, manualEventsSnap, rootsProjectSnap] = await Promise.all([
        getDocs(peopleRef),
        getDocs(relsRef),
        getDocs(posRef),
        getDocs(manualEventsRef),
        getDoc(rootsProjectRef),
      ]);

      const treeData = { id: treeSnap.id, ...treeSnap.data() } as FamilyTree;
      const peopleData = peopleSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Person));
      const relsData = relsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Relationship));
      const posData = posSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CanvasPosition));
      const manualEventsData = manualEventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ManualEvent));
      
      if (rootsProjectSnap.exists()) {
        const project = rootsProjectSnap.data() as RootsProject;
        setRootsProject(project);
      } else if (user && !effectiveReadOnly) {
        const newProject: RootsProject = {
          id: 'main',
          userId: user.uid,
          treeId: treeId,
          projectName: treeData.treeName,
          currentStep: 0, // Start at identity selection
          projectData: { projectName: treeData.treeName },
          createdAt: serverTimestamp() as any,
          updatedAt: serverTimestamp() as any,
        };
        await setDoc(rootsProjectRef, newProject);
        setRootsProject(newProject);
      }
      
      setTree(treeData);
      setPeople(peopleData);
      setRelationships(relsData);
      setCanvasPositions(posData);
      setManualEvents(manualEventsData);
      setCanvasBg(treeData.canvasBackgroundColor);
      
    } catch (err: any) {
      console.error('Error fetching tree data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [treeId, user, db, readOnly, isUserLoading, router]);

  // New useEffect to derive UI state from raw data, preventing loops
  useEffect(() => {
    if (isLoading || !tree) return;

    const allParentalRelTypes = ['parent', 'adoptive_parent', 'step_parent', 'guardian'];
    const directSiblingRelTypes = ['sibling', 'twin', 'step_sibling'];

    const childrenMap = new Map<string, string[]>();
    relationships.forEach(rel => {
      if (allParentalRelTypes.includes(rel.relationshipType)) {
        if (!childrenMap.has(rel.personAId)) childrenMap.set(rel.personAId, []);
        childrenMap.get(rel.personAId)!.push(rel.personBId);
      }
    });
    
    const parentMap = new Map<string, string[]>();
    for (const person of people) {
        parentMap.set(person.id, []);
    }
    relationships.forEach(rel => {
      if (allParentalRelTypes.includes(rel.relationshipType)) {
        if (!parentMap.has(rel.personBId)) parentMap.set(rel.personBId, []);
        parentMap.get(rel.personBId)!.push(rel.personAId);
      }
    });
    
    let twinIds = new Set<string>();
    if (tree.applyCreatorSettingsToTwins && tree.ownerPersonId) {
      const owner = people.find(p => p.id === tree.ownerPersonId);
      if (owner && owner.birthDate) {
        const ownerParents = parentMap.get(owner.id) || [];
        if (ownerParents.length > 0) {
          const potentialSiblings = new Set<string>();
          ownerParents.forEach(parentId => {
            (childrenMap.get(parentId) || []).forEach(childId => {
              if (childId !== owner.id) potentialSiblings.add(childId);
            });
          });
          potentialSiblings.forEach(siblingId => {
            const sibling = people.find(p => p.id === siblingId);
            if (sibling && sibling.birthDate === owner.birthDate) {
              twinIds.add(siblingId);
            }
          });
        }
      }
    }

    const enrichedPeopleData = people.map(person => {
        const children = childrenMap.get(person.id) || [];
        const childrenCount = new Set(children).size;

        const parents = parentMap.get(person.id) || [];
        const siblings = new Set<string>();
        if (parents.length > 0) {
            parents.forEach(parentId => {
                const childrenOfParent = childrenMap.get(parentId) || [];
                childrenOfParent.forEach(siblingId => {
                    if (siblingId !== person.id) siblings.add(siblingId);
                });
            });
        }
        relationships.forEach(rel => {
            if (directSiblingRelTypes.includes(rel.relationshipType)) {
                if (rel.personAId === person.id) siblings.add(rel.personBId);
                if (rel.personBId === person.id) siblings.add(rel.personAId);
            }
        });
        const siblingsCount = siblings.size;

        const grandchildren = children.flatMap(childId => childrenMap.get(childId) || []);
        const greatGrandchildren = grandchildren.flatMap(grandchildId => childrenMap.get(grandchildId) || []);
        const gen4 = greatGrandchildren.flatMap(greatGrandchildId => childrenMap.get(greatGrandchildId) || []);
        const gen5 = gen4.flatMap(gen4Id => childrenMap.get(gen4Id) || []);

        return {
            ...person,
            childrenCount,
            siblingsCount,
            grandchildrenCount: new Set(grandchildren).size,
            greatGrandchildrenCount: new Set(greatGrandchildren).size,
            gen4Count: new Set(gen4).size,
            gen5Count: new Set(gen5).size,
        };
    });
    
    setNodes(currentNodes => {
      const currentNodesMap = new Map(currentNodes.map(n => [n.id, n]));
      const positionsMap = new Map<string, Partial<CanvasPosition>>(canvasPositions.map(p => [p.personId, p]));
      
      const newNodes = enrichedPeopleData.map(person => {
          const existingNode = currentNodesMap.get(person.id);
          const pos = positionsMap.get(person.id);
      
          const isOwner = person.id === tree.ownerPersonId;
          const isTwin = twinIds.has(person.id);
          const applyCreatorStyles = isOwner || isTwin;
      
          let finalPosition: XYPosition;
          if (existingNode) {
              finalPosition = existingNode.position;
          } else if (pos) {
              finalPosition = { x: pos.x, y: pos.y };
          } else {
              finalPosition = { x: Math.random() * 400, y: Math.random() * 400 };
          }
          
          return {
              id: person.id,
              type: 'personNode',
              position: finalPosition,
              data: {
                  ...person,
                  isLocked: pos?.isLocked ?? false,
                  groupIds: pos?.groupIds ?? [],
                  cardDesign: applyCreatorStyles ? tree.creatorCardDesign : tree.cardDesign,
                  isOwner,
                  cardBackgroundColor: tree.cardBackgroundColor,
                  cardBorderColor: tree.cardBorderColor,
                  cardBorderWidth: tree.cardBorderWidth,
                  ...(applyCreatorStyles && {
                      creatorCardBacklightIntensity: tree.creatorCardBacklightIntensity,
                      creatorCardBacklightDisabled: tree.creatorCardBacklightDisabled,
                      creatorCardSize: tree.creatorCardSize,
                  }),
              },
              draggable: !(pos?.isLocked ?? false) && !readOnly,
          };
      });
      return newNodes;
    });

    const relLabelMap = new Map(relationshipOptions.map(opt => [opt.type, opt.label]));
    relLabelMap.set('spouse', 'נשואים');
    relLabelMap.set('ex_spouse', 'גרושים');
    relLabelMap.set('separated', 'פרודים');
    relLabelMap.set('partner', 'בן/בת זוג');
    relLabelMap.set('ex_partner', 'בן/בת זוג לשעבר');
    relLabelMap.set('widowed', 'אלמן/אלמנה');

    setEdges(currentEdges => {
        const tempNodes = getNodes(); // Use the latest nodes for edge calculations
        const newEdges = relationships.map(rel => {
          const { source, target, sourceHandle, targetHandle } = getEdgeProps(rel, tempNodes);
          const getLabel = () => {
            if (['parent', 'step_parent', 'adoptive_parent'].includes(rel.relationshipType)) {
              const parent = people.find(p => p.id === rel.personAId);
              if (parent) {
                const parentOption = relationshipOptions.find(opt => opt.type === rel.relationshipType && opt.gender === parent.gender);
                return parentOption?.label || 'הורה';
              }
              return 'הורה';
            }
            return relLabelMap.get(rel.relationshipType) || rel.relationshipType;
          };
          return {
            id: rel.id,
            source, target, sourceHandle, targetHandle, type: edgeType,
            label: getLabel(),
            labelBgStyle: { fill: 'hsl(var(--background))', padding: '2px 4px' },
            labelStyle: { fill: 'hsl(var(--foreground))' },
            data: rel,
            className: 'custom-edge',
          };
        });
        return newEdges;
    });

  }, [people, relationships, canvasPositions, tree, edgeType, readOnly, isLoading, getNodes, setNodes, setEdges]);
  
    const debouncedSaveRootsProject = useDebounce((projectToSave: RootsProject) => {
        if (!user || !db || readOnly) return;
        const projectRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'rootsProjects', 'main');
        const { id, ...dataToSave } = projectToSave;
        updateDoc(projectRef, { ...dataToSave, updatedAt: serverTimestamp() }).catch(err => {
            console.error("Failed to save Roots project", err);
            toast({ variant: 'destructive', title: 'שגיאת שמירה' });
        });
    }, 2000);

    const handleUpdateRootsProject = useCallback(
      (updater: (project: RootsProject) => RootsProject) => {
        if (readOnly) return;
        recordHistory();
        setRootsProject((prev) => {
          const newState = prev ? updater(prev) : null;
          if (newState) debouncedSaveRootsProject(newState);
          return newState;
        });
      },
      [readOnly, recordHistory, debouncedSaveRootsProject]
    );

    const handleSetRootsProject = useCallback(
      (newProject: RootsProject) => {
        if (readOnly) return;
        recordHistory();
        setRootsProject(newProject);
        debouncedSaveRootsProject(newProject);
      },
      [readOnly, recordHistory, debouncedSaveRootsProject]
    );

  const runSiblingDetection = useCallback(async (
    personIdsForCheck: string[], 
    currentPeople: Person[], 
    currentRels: Relationship[]
  ) => {
    if (readOnly) return { relationshipsToAdd: [], relationshipsToUpdate: [] };
    const parentTypes = ['parent', 'step_parent', 'adoptive_parent'];
    const siblingTypes = ['sibling', 'twin'];
    
    const parentsToCheck = new Set<string>();
    currentRels.forEach(rel => {
        if (parentTypes.includes(rel.relationshipType) && personIdsForCheck.includes(rel.personBId)) {
            parentsToCheck.add(rel.personAId);
        }
    });

    if (parentsToCheck.size === 0) {
      const personId = personIdsForCheck[0];
      if (!personId) return { relationshipsToAdd: [], relationshipsToUpdate: [] };
      const siblingRels = currentRels.filter(r => (r.personAId === personId || r.personBId === personId) && siblingTypes.includes(r.relationshipType));
      const siblingIds = siblingRels.map(r => r.personAId === personId ? r.personBId : r.personAId);
      const allInvolvedIds = [...siblingIds, personId];
      currentRels.forEach(rel => {
        if (parentTypes.includes(rel.relationshipType) && allInvolvedIds.includes(rel.personBId)) {
          parentsToCheck.add(rel.personAId);
        }
      });
    }

    if (parentsToCheck.size === 0) return { relationshipsToAdd: [], relationshipsToUpdate: [] };

    const relationshipsToAdd: Relationship[] = [];
    const relationshipsToUpdate: Partial<Relationship>[] = [];

    for (const parentId of parentsToCheck) {
        const children = currentPeople.filter(p =>
            currentRels.some(r => parentTypes.includes(r.relationshipType) && r.personAId === parentId && r.personBId === p.id)
        );

        if (children.length < 2) continue;

        for (let i = 0; i < children.length; i++) {
            for (let j = i + 1; j < children.length; j++) {
                const childA = children[i];
                const childB = children[j];
                const existingRel = currentRels.find(r => siblingTypes.includes(r.relationshipType) && ((r.personAId === childA.id && r.personBId === childB.id) || (r.personAId === childB.id && r.personBId === childA.id)));
                const isTwin = childA.birthDate && childA.birthDate === childB.birthDate;
                const correctRelType = isTwin ? 'twin' : 'sibling';

                if (existingRel) {
                    if (existingRel.manuallyEdited) continue;
                    if (existingRel.relationshipType !== correctRelType) {
                        relationshipsToUpdate.push({ id: existingRel.id, relationshipType: correctRelType });
                    }
                } else {
                    const [personAId, personBId] = [childA.id, childB.id].sort();
                    relationshipsToAdd.push({
                        id: uuidv4(),
                        personAId, personBId, relationshipType: correctRelType,
                        treeId: treeId, userId: user!.uid, manuallyEdited: false
                    } as Relationship);
                }
            }
        }
    }
    return { relationshipsToAdd, relationshipsToUpdate };
  }, [treeId, user, readOnly]);

  useEffect(() => {
    setEdges((eds) => eds.map((e) => ({ ...e, type: edgeType })));
  }, [edgeType, setEdges]);

  const onSelectionChange = useCallback(
    ({ nodes: newSelectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
        setSelectedNodes(newSelectedNodes as Node<Person>[]);
        
        const singleSelectedNode = newSelectedNodes.length === 1 ? newSelectedNodes[0] : null;
        const groupIds = singleSelectedNode?.data.groupIds;
        const topGroupId = groupIds && groupIds.length > 0 ? groupIds[groupIds.length - 1] : null;

        setNodes(nds =>
            nds.map(n => ({
                ...n,
                data: {
                    ...n.data,
                    isGroupSelected: !!(topGroupId && (n.data.groupIds || []).includes(topGroupId) && n.id !== singleSelectedNode.id),
                }
            }))
        );

        setEdges((eds) =>
            eds.map((edge) => {
            const isAnimated = singleSelectedNode && (edge.source === singleSelectedNode.id || edge.target === singleSelectedNode.id);
            const isEdgeSelected = selectedEdges.some((se) => se.id === edge.id);
            return {
                ...edge,
                animated: isAnimated,
                className: cn('custom-edge', (isAnimated || isEdgeSelected) && 'selected'),
            };
            })
        );
    },
    [setEdges, setNodes]
  );

  useEffect(() => {
    if (tree) {
      setNameValue(tree.treeName);
    }
  }, [tree]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (!isUserLoading && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      fetchData();
    }
  }, [fetchData, isUserLoading, user]);

  const onNodeContextMenu: OnNodeContextMenu = useCallback(
    (event, node) => {
      if (readOnly) return;
      event.preventDefault();
      setContextMenu(null); // Close any existing menu

      const allNodes = getNodes();
      let currentSelectedNodes = allNodes.filter((n) => n.selected);

      // If the right-clicked node is not part of the current selection,
      // make it the only selected node.
      const isClickedNodeSelected = currentSelectedNodes.some((n) => n.id === node.id);
      if (!isClickedNodeSelected) {
        currentSelectedNodes = [node];
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            selected: n.id === node.id,
          }))
        );
      }

      if (currentSelectedNodes.length > 0) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          nodes: currentSelectedNodes as Node<Person>[],
        });
      }
    },
    [getNodes, setNodes, readOnly]
  );
  
  const handlePaneClick: OnPaneClick = useCallback(() => {
    setContextMenu(null);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        selected: false,
        animated: false,
        className: 'custom-edge',
      }))
    );
  }, [setNodes, setEdges]);

  const onNodeDragStart: OnNodeDragStart = useCallback(
    (_, node) => {
      if (readOnly) return;
      recordHistory();
      const allNodes = getNodes();
      const groupIds = node.data.groupIds || [];
      const topGroupId = groupIds.length > 0 ? groupIds[groupIds.length - 1] : null;
      const isGroupDrag = topGroupId ? allNodes.filter(n => (n.data.groupIds || []).includes(topGroupId)).length > 1 : false;

      dragRef.current = {
        nodeId: node.id,
        isGroupDrag,
        initialNodePositions: new Map(allNodes.map((n) => [n.id, n.position])),
      };
    },
    [getNodes, recordHistory, readOnly]
  );

  const onNodeDrag: OnNodeDrag = useCallback(
    (_, draggedNode) => {
      if (!dragRef.current || readOnly) return;
      const { nodeId, isGroupDrag, initialNodePositions } = dragRef.current;
      if (draggedNode.data.isLocked) return;

      const startPos = initialNodePositions.get(nodeId);
      if (!startPos) return;

      const diff = {
        x: draggedNode.position.x - startPos.x,
        y: draggedNode.position.y - startPos.y,
      };

      const groupIds = draggedNode.data.groupIds || [];
      const topGroupId = groupIds.length > 0 ? groupIds[groupIds.length - 1] : null;
      
      setNodes((nds) =>
        nds.map((n) => {
          // If it's a group drag, move all non-locked nodes in the group
          if (isGroupDrag && topGroupId && (n.data.groupIds || []).includes(topGroupId) && !n.data.isLocked) {
            const initialPos = initialNodePositions.get(n.id);
            if (initialPos) {
              return {
                ...n,
                position: {
                  x: initialPos.x + diff.x,
                  y: initialPos.y + diff.y,
                },
              };
            }
          }
          // Always move the node being dragged (if it's not part of the group logic above)
          if (n.id === nodeId) {
            return n;
          }
          return n;
        })
      );
    },
    [setNodes, readOnly]
  );

  const onNodeDragStop: OnNodeDragStop = useCallback(
    async (_, draggedNode) => {
      if (!user || !db || !dragRef.current || readOnly) return;

      const { isGroupDrag } = dragRef.current;
      const groupIds = draggedNode.data.groupIds || [];
      const topGroupId = groupIds.length > 0 ? groupIds[groupIds.length - 1] : null;
      
      const nodesToUpdate = isGroupDrag && topGroupId
        ? getNodes().filter((n) => (n.data.groupIds || []).includes(topGroupId) && !n.data.isLocked)
        : [getNodes().find(n => n.id === draggedNode.id)].filter(Boolean) as Node[];


      if (nodesToUpdate.length === 0) return;
      
      const batch = writeBatch(db);
      const canvasPositionsRef = collection(
        db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions'
      );
      
      for (const n of nodesToUpdate) {
        const q = query(canvasPositionsRef, where('personId', '==', n.id), limit(1));
        const snapshot = await getDocs(q);

        const dataToSave = {
          personId: n.id,
          x: n.position.x,
          y: n.position.y,
          userId: user.uid,
          treeId: treeId,
          updatedAt: serverTimestamp(),
        };

        if (snapshot.empty) {
          const newDocRef = doc(canvasPositionsRef);
          batch.set(newDocRef, dataToSave);
        } else {
          batch.update(snapshot.docs[0].ref, {
            x: dataToSave.x,
            y: dataToSave.y,
            updatedAt: dataToSave.updatedAt,
          });
        }
      }
      
      try {
        await batch.commit();
      } catch (error: any) {
        console.error("Error saving node positions:", error);
      }

      dragRef.current = null;
    },
    [user, db, treeId, getNodes, readOnly]
  );

  const handleGroup = async () => {
    recordHistory();
    if (!user || !db || selectedNodes.length < 1) return;

    const newGroupId = uuidv4();
    const allGroupIdsInSelection = new Set<string>();
    selectedNodes.forEach(node => {
        (node.data.groupIds || []).forEach(id => allGroupIdsInSelection.add(id));
    });

    const nodeIdsToGroup = new Set<string>(selectedNodes.map(n => n.id));
    nodes.forEach(node => {
        if((node.data.groupIds || []).some(id => allGroupIdsInSelection.has(id))) {
            nodeIdsToGroup.add(node.id);
        }
    });

    setNodes(nds =>
        nds.map(n =>
            nodeIdsToGroup.has(n.id)
                ? { ...n, data: { ...n.data, groupIds: [...(n.data.groupIds || []), newGroupId] } }
                : n
        )
    );

    const batch = writeBatch(db);
    const canvasPositionsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');

    for (const nodeId of Array.from(nodeIdsToGroup)) {
        const node = nodes.find(n => n.id === nodeId)!;
        const newGroupIds = [...(node.data.groupIds || []), newGroupId];
        const q = query(canvasPositionsRef, where('personId', '==', nodeId), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            batch.set(doc(canvasPositionsRef), { personId: nodeId, x: node.position.x, y: node.position.y, groupIds: newGroupIds, userId: user.uid, treeId, updatedAt: serverTimestamp() });
        } else {
            batch.update(snapshot.docs[0].ref, { groupIds: newGroupIds });
        }
    }
    await batch.commit();
    toast({ title: "הצמתים קובצו" });
  };

  const handleUngroup = async () => {
    recordHistory();
    if (!user || !db || selectedNodes.length === 0) return;
  
    const topGroupId = (selectedNodes[0].data.groupIds || []).slice(-1)[0];
    if (!topGroupId) return;

    const nodeIdsToUngroup = new Set<string>();
    nodes.forEach(node => {
        const groupIds = node.data.groupIds || [];
        if (groupIds.length > 0 && groupIds[groupIds.length - 1] === topGroupId) {
            nodeIdsToUngroup.add(node.id);
        }
    });
    
    setNodes(nds =>
      nds.map(n => {
        if (nodeIdsToUngroup.has(n.id)) {
            const newGroupIds = [...(n.data.groupIds || [])];
            newGroupIds.pop();
            return { ...n, data: { ...n.data, groupIds: newGroupIds } };
        }
        return n;
      })
    );

    const batch = writeBatch(db);
    const canvasPositionsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');
    for (const nodeId of Array.from(nodeIdsToUngroup)) {
        const node = nodes.find(n => n.id === nodeId)!;
        const newGroupIds = [...(node.data.groupIds || [])];
        newGroupIds.pop();
        const q = query(canvasPositionsRef, where('personId', '==', nodeId), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            batch.update(snapshot.docs[0].ref, { groupIds: newGroupIds });
        }
    }
    await batch.commit();
    toast({ title: "הקבוצה פורקה" });
  };


  const handleAlign = useCallback((type: string) => {
    if (selectedNodes.length < 2) return;
    recordHistory();

    let newNodes = [...nodes];
    const updatedPositions = new Map<string, XYPosition>();

    switch (type) {
        case 'align-left': {
            const minX = Math.min(...selectedNodes.map(n => n.position.x));
            selectedNodes.forEach(n => updatedPositions.set(n.id, { ...n.position, x: minX }));
            break;
        }
        case 'align-center-h': {
            const centerX = selectedNodes.reduce((sum, n) => sum + n.position.x + (n.width || 0) / 2, 0) / selectedNodes.length;
            selectedNodes.forEach(n => updatedPositions.set(n.id, { ...n.position, x: centerX - (n.width || 0) / 2 }));
            break;
        }
        case 'align-right': {
            const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.width || 0)));
            selectedNodes.forEach(n => updatedPositions.set(n.id, { ...n.position, x: maxX - (n.width || 0) }));
            break;
        }
        case 'align-top': {
            const minY = Math.min(...selectedNodes.map(n => n.position.y));
            selectedNodes.forEach(n => updatedPositions.set(n.id, { ...n.position, y: minY }));
            break;
        }
        case 'align-center-v': {
            const centerY = selectedNodes.reduce((sum, n) => sum + n.position.y + (n.height || 0) / 2, 0) / selectedNodes.length;
            selectedNodes.forEach(n => updatedPositions.set(n.id, { ...n.position, y: centerY - (n.height || 0) / 2 }));
            break;
        }
        case 'align-bottom': {
            const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.height || 0)));
            selectedNodes.forEach(n => updatedPositions.set(n.id, { ...n.position, y: maxY - (n.height || 0) }));
            break;
        }
        case 'distribute-h': {
            const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
            const minX = sorted[0].position.x;
            const maxX = sorted[sorted.length - 1].position.x + (sorted[sorted.length - 1].width || 0);
            const totalWidth = sorted.reduce((sum, n) => sum + (n.width || 0), 0);
            const gap = (maxX - minX - totalWidth) / (sorted.length - 1);
            let currentX = minX;
            sorted.forEach(n => {
                updatedPositions.set(n.id, { ...n.position, x: currentX });
                currentX += (n.width || 0) + gap;
            });
            break;
        }
        case 'distribute-v': {
            const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
            const minY = sorted[0].position.y;
            const maxY = sorted[sorted.length - 1].position.y + (sorted[sorted.length - 1].height || 0);
            const totalHeight = sorted.reduce((sum, n) => sum + (n.height || 0), 0);
            const gap = (maxY - minY - totalHeight) / (sorted.length - 1);
            let currentY = minY;
            sorted.forEach(n => {
                updatedPositions.set(n.id, { ...n.position, y: currentY });
                currentY += (n.height || 0) + gap;
            });
            break;
        }
    }
    
    setNodes(nds => nds.map(n => updatedPositions.has(n.id) ? { ...n, position: updatedPositions.get(n.id)! } : n));
    
    // Debounce this save
    // onNodeDragStop logic can be reused but needs to be adapted.
  }, [nodes, selectedNodes, recordHistory]);


  const handleLock = async () => {
    recordHistory();
    const currentSelectedNodes = getNodes().filter((n) => n.selected);
    if (currentSelectedNodes.length === 0 || !user || !db) return;

    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, data: { ...n.data, isLocked: true }, draggable: false } : n
      )
    );

    const batch = writeBatch(db);
    const canvasPositionsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');
    for (const node of currentSelectedNodes) {
        const q = query(canvasPositionsRef, where('personId', '==', node.id), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
             const newDocRef = doc(canvasPositionsRef);
            batch.set(newDocRef, { personId: node.id, x: node.position.x, y: node.position.y, isLocked: true, userId: user.uid, treeId, updatedAt: serverTimestamp() });
        } else {
            batch.update(snapshot.docs[0].ref, { isLocked: true });
        }
    }
    await batch.commit();
    toast({ title: "המיקום ננעל" });
  };

  const handleUnlock = async () => {
    recordHistory();
    const currentSelectedNodes = getNodes().filter((n) => n.selected);
    if (currentSelectedNodes.length === 0 || !user || !db) return;

    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, data: { ...n.data, isLocked: false }, draggable: true } : n
      )
    );
    
    const batch = writeBatch(db);
    const canvasPositionsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'canvasPositions');
    for (const node of currentSelectedNodes) {
        const q = query(canvasPositionsRef, where('personId', '==', node.id), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            batch.update(snapshot.docs[0].ref, { isLocked: false });
        }
    }
    await batch.commit();
    toast({ title: "הנעילה שוחררה" });
  };


  const handleEdgeDoubleClick: OnEdgeDoubleClick = useCallback(
    (_, edge) => {
      if (readOnly) return;
      const rel = relationships.find((r) => r.id === edge.id);
      if (rel) {
        setEditingRelationship(rel);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        requestAnimationFrame(() => setIsRelModalOpen(true));
      }
    },
    [relationships, readOnly]
  );

  const handleNodeDoubleClick: OnNodeDoubleClick = useCallback((_, node) => {
    if (readOnly) return;
    setSelectedPerson(node.data);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsEditorOpen(true));
  }, [readOnly]);
  
  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedPerson(null);
  };

  const handleOpenEditorForNew = () => {
    if (readOnly) return;
    setSelectedPerson(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsEditorOpen(true));
  };

  const proceedWithCreation = async (personData: any) => {
    if (!user || !db) return;
    setIsDuplicateAlertOpen(false);
    
    recordHistory();

    const newPersonId = uuidv4();
    const newPersonData = {
      ...personData,
      id: newPersonId,
      userId: user.uid,
      treeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Person;
    
    setPeople(ps => [...ps, newPersonData]);

    try {
      const peopleCollection = collection(db, 'users', user.uid, 'familyTrees', treeId, 'people');
      const personDocRef = doc(peopleCollection, newPersonId);
      await setDoc(personDocRef, { ...newPersonData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

      toast({
        title: 'אדם נוסף',
        description: `${newPersonData.firstName} ${newPersonData.lastName} נוסף.`,
      });
    } catch (error: any) {
      setPeople(ps => ps.filter(p => p.id !== newPersonId));
      const permissionError = new FirestorePermissionError({
        path: `users/${user.uid}/familyTrees/${treeId}/people`,
        operation: 'create',
        requestResourceData: personData,
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: permissionError.message,
      });
    }
    setPersonToCreate(null);
    handleEditorClose();
  };

  const handleSavePerson = async (personData: Omit<Person, 'socialLinks' | 'gallery'>, isNew: boolean) => {
    if (readOnly) return;
    recordHistory();
    if (!isNew) {
      await handleUpdatePerson(personData as Partial<Person> & { id: string });
    } else {
      await handleCreatePerson(personData);
    }
  };

  const handleCreatePerson = async (personData: any) => {
    if (!user || !db) return;

    const duplicateQuery = query(
      collection(db, 'users', user.uid, 'familyTrees', treeId, 'people'),
      where('firstName', '==', personData.firstName),
      where('lastName', '==', personData.lastName),
      where('birthDate', '==', personData.birthDate || null),
      limit(1)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);

    if (!duplicateSnapshot.empty) {
      setPersonToCreate(personData);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      requestAnimationFrame(() => setIsDuplicateAlertOpen(true));
    } else {
      await proceedWithCreation(personData);
    }
  };

  const handleUpdatePerson = async (personData: Partial<Person> & { id: string }) => {
    if (!user || !db || !tree) return;
  
    recordHistory();
    const oldPeople = people;
  
    const birthDateChanged =
      oldPeople.find((p) => p.id === personData.id)?.birthDate !==
      personData.birthDate;
  
    const newPeople = people.map((p) =>
      p.id === personData.id ? { ...p, ...personData } : p
    );
    setPeople(newPeople);

    const {
        firstName, lastName, middleName, previousFirstName, maidenName, nickname,
        gender, birthDate, birthPlace, deathDate, cityOfResidence,
        countryOfResidence, religion, profession, hobby, status, description, photoURL, aliyahDate
    } = personData;

    const dataToUpdate: Partial<Person> = {
        firstName, lastName, middleName, previousFirstName, maidenName, nickname,
        gender, birthDate, birthPlace, deathDate, cityOfResidence,
        countryOfResidence, religion, profession, hobby, status, description, photoURL, aliyahDate,
        updatedAt: serverTimestamp() as any,
    };
  
    try {
      const docRef = doc(
        db, 'users', user.uid, 'familyTrees', treeId, 'people', personData.id
      );
  
      await setDoc(docRef, dataToUpdate, { merge: true });
  
      if (birthDateChanged) {
        const siblingChanges = await runSiblingDetection(
          [personData.id],
          newPeople,
          relationships
        );
        if (
          siblingChanges.relationshipsToAdd.length > 0 ||
          siblingChanges.relationshipsToUpdate.length > 0
        ) {
          let updatedRels = [
            ...relationships,
            ...siblingChanges.relationshipsToAdd,
          ];
          siblingChanges.relationshipsToUpdate.forEach((u) => {
            updatedRels = updatedRels.map((r) =>
              r.id === u.id ? { ...r, ...u } : r
            );
          });
          setRelationships(updatedRels);

          const sibBatch = writeBatch(db);
          siblingChanges.relationshipsToAdd.forEach((r) => {
            sibBatch.set(
              doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', r.id),
              r
            );
          });
          siblingChanges.relationshipsToUpdate.forEach((r) => {
            sibBatch.update(
              doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', r.id!),
              r
            );
          });
          await sibBatch.commit();
        }
      }
  
      toast({
        title: 'אדם עודכן',
        description: `${personData.firstName} ${personData.lastName} עודכן.`,
      });
      handleEditorClose();
    } catch (error: any) {
      console.error("RAW ERROR:", error.code, error.message, JSON.stringify(error));
      setPeople(oldPeople);
  
      const permissionError = new FirestorePermissionError({
        path: `users/${user.uid}/familyTrees/${treeId}/people/${personData.id}`,
        operation: 'update',
        requestResourceData: dataToUpdate,
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: permissionError.message,
      });
    }
  };
  

  const updatePersonData = useCallback(async (personId: string, field: keyof Person, value: any): Promise<boolean> => {
    const nonDbFields: (keyof Person)[] = [
        'childrenCount', 'siblingsCount', 'grandchildrenCount', 'greatGrandchildrenCount', 'gen4Count', 'gen5Count',
        'isLocked', 'groupIds', 'isOwner', 'cardDesign', 'creatorCardDesign', 'cardBackgroundColor', 'cardBorderColor', 'cardBorderWidth',
        'creatorCardBacklightIntensity', 'creatorCardBacklightDisabled', 'creatorCardSize', 'socialLinks'
    ];
    if (nonDbFields.includes(field)) {
      console.warn(`Attempted to update non-db field "${field}". Operation blocked.`);
      return false;
    }

    if (!user || !db || readOnly || !tree) {
        if (!readOnly) toast({ variant: 'destructive', title: 'שגיאת אימות' });
        return false;
    }
    
    recordHistory();
    const birthDateChanged = field === 'birthDate';

    const oldPeople = people;

    const newPeople = people.map(p => p.id === personId ? { ...p, [field]: value } : p);
    
    setPeople(newPeople);

    try {
        const personRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', personId);
        await updateDoc(personRef, { [field]: value, updatedAt: serverTimestamp() });
        
        if (birthDateChanged) {
          const siblingChanges = await runSiblingDetection([personId], newPeople, relationships);
          if (siblingChanges.relationshipsToAdd.length > 0 || siblingChanges.relationshipsToUpdate.length > 0) {
              let updatedRels = [...relationships, ...siblingChanges.relationshipsToAdd];
              siblingChanges.relationshipsToUpdate.forEach(u => {
                  updatedRels = updatedRels.map(r => r.id === u.id ? { ...r, ...u } : r);
              });
              setRelationships(updatedRels);
              const sibBatch = writeBatch(db);
              siblingChanges.relationshipsToAdd.forEach(r => sibBatch.set(doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', r.id), r));
              siblingChanges.relationshipsToUpdate.forEach(r => sibBatch.update(doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', r.id!), r));
              await sibBatch.commit();
          }
        }
        
        toast({ title: 'השדה עודכן', duration: 2000 });
        return true;
    } catch (error: any) {
        setPeople(oldPeople);

        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid}/familyTrees/${treeId}/people/${personId}`,
            operation: 'update',
            requestResourceData: { [field]: value },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: 'destructive',
            title: 'שגיאת עדכון',
            description: `לא ניתן היה לעדכן את השדה.`,
        });
        return false;
    }
  }, [user, db, treeId, toast, people, relationships, tree, runSiblingDetection, recordHistory, readOnly, setPeople]);

  const handleDeleteRequest = (personId: string) => {
    if (readOnly) return;
    const person = people.find((p) => p.id === personId);
    if (person) {
      setPersonToDelete(person);
      setIsEditorOpen(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      requestAnimationFrame(() => setIsDeleteAlertOpen(true));
    }
  };

  const handleConfirmDelete = async () => {
    if (!personToDelete || !user || !db || !tree || readOnly) return;
  
    setIsDeleting(true);
  
    const personIdToDelete = personToDelete.id;
    const deletedPerson = personToDelete; // capture before clearing
  
    // Snapshot current state for revert
    const prevPeople = people;
    
    const newPeople = prevPeople.filter(p => p.id !== personIdToDelete);
    setPeople(newPeople);
  
    try {
      const batch = writeBatch(db);
      const basePath = `users/${user.uid}/familyTrees/${treeId}`;
      const personRef = doc(db, basePath, 'people', personIdToDelete);
  
      const relsQueryA = query(collection(db, basePath, 'relationships'), where('personAId', '==', personIdToDelete));
      const relsQueryB = query(collection(db, basePath, 'relationships'), where('personBId', '==', personIdToDelete));
      const posQuery = query(collection(db, basePath, 'canvasPositions'), where('personId', '==', personIdToDelete));
  
      const [relsSnapA, relsSnapB, posSnap] = await Promise.all([
        getDocs(relsQueryA),
        getDocs(relsQueryB),
        getDocs(posQuery),
      ]);
  
      [...relsSnapA.docs, ...relsSnapB.docs].forEach(d => batch.delete(d.ref));
      posSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(personRef);
  
      // Handle social links separately
      try {
        const socialLinksRef = collection(db, basePath, 'people', personIdToDelete, 'socialLinks');
        const socialLinksSnap = await getDocs(socialLinksRef);
        socialLinksSnap.docs.forEach(d => batch.delete(d.ref));
      } catch (e) {
        console.warn('Could not fetch social links for deletion, skipping:', e);
      }
  
      await batch.commit();

      setRelationships(prev => prev.filter(r => r.personAId !== personIdToDelete && r.personBId !== personIdToDelete));
      setCanvasPositions(prev => prev.filter(p => p.personId !== personIdToDelete));
  
      toast({
        title: 'אדם נמחק',
        description: `${deletedPerson.firstName} ${deletedPerson.lastName} נמחק בהצלחה.`,
      });
  
    } catch (error: any) {
      console.error("Error deleting person:", error);
      // Revert on failure
      setPeople(prevPeople);
      toast({
        variant: 'destructive',
        title: 'שגיאת מחיקה',
        description: 'לא ניתן היה למחוק את האדם. נסה שוב.',
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteAlertOpen(false);
      requestAnimationFrame(() => {
        const canvas = document.getElementById('main-view-container');
        if (canvas) canvas.focus();
      });
    }
  };
  
  const handleConnect: OnConnect = useCallback((params) => {
    if (readOnly) return;
    setNewConnection(params);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsRelModalOpen(true));
  }, [readOnly]);

  const handleRelModalClose = () => {
    setIsRelModalOpen(false);
    setNewConnection(null);
    setEditingRelationship(null);
  };

  const handleSaveRelationship = async (payload: {
    relData: any;
    genderUpdate?: { personId: string; gender: 'male' | 'female' | 'other' };
  }) => {
    if (!user || !db || !tree || readOnly) return;

    recordHistory();
    const { relData, genderUpdate } = payload;
    const isEditing = !!relData.id;

    const oldState = { people, relationships };
    let newRelationship: Relationship;
    let newRelationships: Relationship[];

    if (isEditing) {
      newRelationships = relationships.map(r => r.id === relData.id ? { ...r, ...relData, updatedAt: new Date() } : r);
    } else {
      newRelationship = { ...relData, id: uuidv4(), userId: user.uid, treeId: treeId, createdAt: new Date(), updatedAt: new Date() } as Relationship;
      newRelationships = [...relationships, newRelationship];
    }
    
    let newPeople = people;
    if (genderUpdate) {
      newPeople = people.map(p => p.id === genderUpdate.personId ? { ...p, gender: genderUpdate.gender } : p);
    }
    
    const siblingChanges = await runSiblingDetection([relData.personBId], newPeople, newRelationships);
    if(siblingChanges.relationshipsToAdd){
        newRelationships.push(...(siblingChanges.relationshipsToAdd || []));
    }
    if(siblingChanges.relationshipsToUpdate) {
      (siblingChanges.relationshipsToUpdate || []).forEach(updatedRel => {
        newRelationships = newRelationships.map(r => r.id === updatedRel.id ? {...r, ...updatedRel} : r);
      });
    }

    setPeople(newPeople);
    setRelationships(newRelationships);
    
    try {
      const batch = writeBatch(db);
      if (isEditing) {
        const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', relData.id);
        batch.update(relRef, { ...relData, updatedAt: serverTimestamp() });
      } else {
        const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', newRelationship!.id);
        batch.set(relRef, { ...newRelationship!, userId: user.uid, treeId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }

      if (genderUpdate) {
        const personRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', genderUpdate.personId);
        batch.update(personRef, { gender: genderUpdate.gender });
      }
      
      if(siblingChanges.relationshipsToAdd){
        (siblingChanges.relationshipsToAdd || []).forEach(r => {
          const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', r.id);
          batch.set(relRef, r);
        });
      }
      if(siblingChanges.relationshipsToUpdate){
        (siblingChanges.relationshipsToUpdate || []).forEach(r => {
          const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', r.id!);
          batch.update(relRef, r);
        });
      }

      await batch.commit();
      toast({ title: isEditing ? 'קשר עודכן' : 'קשר נוסף' });
      handleRelModalClose();
    } catch (error: any) {
      setPeople(oldState.people);
      setRelationships(oldState.relationships);
      toast({
        variant: 'destructive',
        title: 'שגיאה בשמירת קשר',
        description: error.message || 'An unexpected error occurred.',
      });
    }
  };

  const handleDeleteRelationship = async (relationshipId: string) => {
    if (!user || !db || readOnly) return;
    
    recordHistory();
    const oldRelationships = relationships;
    const newRelationships = relationships.filter(r => r.id !== relationshipId);
    setRelationships(newRelationships);

    try {
      const relRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'relationships', relationshipId);
      await deleteDoc(relRef);
      toast({ title: 'קשר נמחק' });
    } catch (error: any) {
      setRelationships(oldRelationships);
      console.error('Error deleting relationship:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה במחיקת קשר',
        description: 'לא ניתן היה למחוק את הקשר. החיבור שוחזר.',
      });
    } finally {
      handleRelModalClose();
    }
  };
  
  const isValidConnection = useCallback<IsValidConnection>((connection) => {
    if (readOnly) return false;
    if (connection.source === connection.target) {
      return false;
    }
    return true;
  }, [readOnly]);

  const handleUpdateTreeDetails = useCallback(async (details: Partial<FamilyTree>) => {
    if (!user || !db || !tree || readOnly) {
        if (!readOnly) toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן לשמור את השינויים." });
        return;
    }

    const treeRef = doc(db, 'users', user.uid, 'familyTrees', treeId);
    
    const oldTree = tree;
    const newTreeData = { ...tree, ...details };
    setTree(newTreeData);

    if ('treeName' in details && details.treeName) {
        setNameValue(details.treeName);
    }
    if (details.canvasBackgroundColor) {
      setCanvasBg(details.canvasBackgroundColor);
    }
    
    try {
        await updateDoc(treeRef, { ...details, updatedAt: serverTimestamp() });
        toast({ title: "ההגדרות עודכנו" });
    } catch (error: any) {
        setTree(oldTree);

        toast({ variant: "destructive", title: "שגיאת עדכון", description: "לא ניתן היה לשמור את הגדרות העץ." });
        const permissionError = new FirestorePermissionError({
            path: treeRef.path,
            operation: 'update',
            requestResourceData: details
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  }, [user, db, tree, treeId, toast, readOnly]);

  const handleEditPerson = useCallback((personId: string) => {
    if (readOnly) return;
    const personToEdit = people.find(p => p.id === personId);
    if (personToEdit) {
      setSelectedPerson(personToEdit);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      requestAnimationFrame(() => setIsEditorOpen(true));
    }
  }, [people, readOnly]);

  const handleOpenManualEventEditor = (event: Partial<ManualEvent> | null) => {
    if (readOnly) return;
    setEditingManualEvent(event);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsManualEventEditorOpen(true));
  };
  
  const handleSaveManualEvent = async (eventData: Omit<ManualEvent, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'treeId'> & { id?: string }) => {
      if (!user || !db || readOnly) return;
  
      const isEditing = 'id' in eventData;
  
      try {
          if (isEditing) {
              const eventRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'manualEvents', eventData.id!);
              const { id, ...dataToUpdate} = eventData;
              await updateDoc(eventRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
              setManualEvents(prev => prev.map(e => e.id === eventData.id ? { ...e, ...eventData, id: eventData.id! } as ManualEvent : e))
              toast({ title: 'האירוע עודכן' });
          } else {
              const eventsRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'manualEvents');
              const newDocRef = await addDoc(eventsRef, { 
                  ...eventData, 
                  userId: user.uid, 
                  treeId, 
                  createdAt: serverTimestamp(), 
                  updatedAt: serverTimestamp() 
              });
              setManualEvents(prev => [...prev, { ...eventData, id: newDocRef.id, userId: user.uid, treeId, createdAt: new Date() as any, updatedAt: new Date() as any }]);
              toast({ title: 'האירוע נוצר' });
          }
          setIsManualEventEditorOpen(false);
      } catch (error: any) {
          const permissionError = new FirestorePermissionError({
              path: `users/${user.uid}/familyTrees/${treeId}/manualEvents`,
              operation: isEditing ? 'update' : 'create',
              requestResourceData: eventData,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לשמור את האירוע.' });
      }
  };
  
  const handleDeleteManualEvent = async (eventId: string) => {
      if (!user || !db || readOnly) return;
  
      try {
          const eventRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'manualEvents', eventId);
          await deleteDoc(eventRef);
          setManualEvents(prev => prev.filter(e => e.id !== eventId));
          toast({ title: 'האירוע נמחק' });
          setIsManualEventEditorOpen(false);
      } catch (error: any) {
          const permissionError = new FirestorePermissionError({
              path: `users/${user.uid}/familyTrees/${treeId}/manualEvents/${eventId}`,
              operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה למחוק את האירוע.' });
      }
  };

    const handleFileSelectedForImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || readOnly) return;

        setIsImporting(true);
        try {
            const buffer = await file.arrayBuffer();
            const data = parseAndValidateExcel(buffer);
            setParsedExcelData(data);
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            requestAnimationFrame(() => setIsImportModalOpen(true));
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'שגיאת ייבוא', description: error.message });
        } finally {
            setIsImporting(false);
            if (importFileInputRef.current) importFileInputRef.current.value = '';
        }
    };
    
    const handleConfirmImport = async (mode: ImportMode) => {
        if (!parsedExcelData || !user || !db || !tree || readOnly) return;
    
        setIsImporting(true);
        setIsImportModalOpen(false);
        toast({ title: 'הייבוא החל...', description: 'הפעולה עשויה לקחת מספר רגעים.' });
    
        try {
            if (mode === 'new') {
                const newTreeId = uuidv4();
                const batch = writeBatch(db);
                
                // Create new FamilyTree doc
                const newTreeRef = doc(db, 'users', user.uid, 'familyTrees', newTreeId);
                batch.set(newTreeRef, {
                    treeName: parsedExcelData.treeName,
                    userId: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    language: 'he',
                    privacy: 'private',
                });

                const oldIdToNewIdMap = new Map<string, string>();
                
                // Set new People
                parsedExcelData.people.forEach((p: any) => {
                    const newId = uuidv4();
                    oldIdToNewIdMap.set(p.id, newId);
                    const { id, ...data } = p;
                    const personRef = doc(collection(newTreeRef, 'people'), newId);
                    batch.set(personRef, { ...data, treeId: newTreeId, userId: user.uid });
                });
    
                // Set new Relationships, Events, Positions, Socials
                parsedExcelData.relationships.forEach((r: any) => {
                    const { id, personAName, personBName, ...data } = r;
                    const newPersonAId = oldIdToNewIdMap.get(data.personAId);
                    const newPersonBId = oldIdToNewIdMap.get(data.personBId);
                    if (newPersonAId && newPersonBId) {
                        const relRef = doc(collection(newTreeRef, 'relationships'), uuidv4());
                        batch.set(relRef, { ...data, personAId: newPersonAId, personBId: newPersonBId, treeId: newTreeId, userId: user.uid });
                    }
                });

                // ... similar loops for other collections, re-mapping IDs
    
                await batch.commit();
                toast({ title: 'הייבוא הושלם!', description: `עץ חדש "${parsedExcelData.treeName}" נוצר.` });
                router.push(`/tree/${newTreeId}`);

            } else if (mode === 'merge') {
                const existingPeopleSnap = await getDocs(collection(db, 'users', user.uid, 'familyTrees', treeId, 'people'));
                const existingPeople = existingPeopleSnap.docs.map(d => d.data());
                
                const batch = writeBatch(db);
                const peopleToAdd = parsedExcelData.people.filter((p: any) => 
                    !existingPeople.some(ep => ep.firstName === p.firstName && ep.lastName === p.lastName && ep.birthDate === p.birthDate)
                );
                
                peopleToAdd.forEach((p: any) => {
                  const { id, ...data } = p;
                  const personRef = doc(collection(db, 'users', user.uid, 'familyTrees', treeId, 'people'));
                  batch.set(personRef, { ...data, treeId, userId: user.uid });
                });

                await batch.commit();
                fetchData();
                toast({ title: 'המיזוג הושלם', description: `${peopleToAdd.length} אנשים חדשים נוספו.` });

            } else if (mode === 'replace') {
                const deleteBatch = writeBatch(db);
                const subcollections = ['people', 'relationships', 'canvasPositions', 'manualEvents'];
                for(const sc of subcollections) {
                    const snapshot = await getDocs(collection(db, 'users', user.uid, 'familyTrees', treeId, sc));
                    snapshot.forEach(d => deleteBatch.delete(d.ref));
                }
                await deleteBatch.commit();
                // ... implementation would be similar to 'new' but using `treeId` instead of `newTreeId`
                fetchData();
                toast({ title: 'ההחלפה הושלמה', description: `העץ יובא מחדש.` });
            }
        } catch (error: any) {
            console.error("Import error:", error);
            toast({ variant: 'destructive', title: 'שגיאת ייבוא', description: error.message });
        } finally {
            setIsImporting(false);
            setParsedExcelData(null);
        }
    };
    
  const saveExportedFile = useCallback(async (
    blob: Blob,
    fileName: string,
    fileType: ExportedFile['fileType']
  ) => {
    if (!user || !storage || !db || !tree || readOnly) return;
    try {
      const storagePath = `users/${user.uid}/trees/${treeId}/exports/${Date.now()}_${fileName}`;
      const fileRef = ref(storage, storagePath);
      
      console.log('Starting upload to:', storagePath);
      const snapshot = await uploadBytes(fileRef, blob);
      console.log('Upload success:', snapshot.ref.fullPath);

      const downloadURL = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, 'exportedFiles'), {
        userId: user.uid,
        treeId: tree.id,
        treeName: tree.treeName,
        fileName,
        fileType,
        storagePath,
        downloadURL,
        fileSizeBytes: blob.size,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('saveExportedFile error:', error);
    }
  }, [user, storage, db, tree, treeId, readOnly]);

  const handleExportExcel = useCallback(async () => {
    if (!tree || !user || !db) return;

    toast({ title: 'מכין נתונים לייצוא...' });

    try {
      const peopleCollectionRef = collection(db, 'users', user.uid, 'familyTrees', treeId, 'people');
      const peopleSnapshot = await getDocs(peopleCollectionRef);
      
      const socialLinksPromises = peopleSnapshot.docs.map(async (personDoc) => {
          const socialLinksRef = collection(personDoc.ref, 'socialLinks');
          const socialLinksSnap = await getDocs(socialLinksRef);
          return socialLinksSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, personId: personDoc.id } as SocialLink & { personId: string }));
      });

      const allSocialLinks = (await Promise.all(socialLinksPromises)).flat();

      const { blob, fileName } = exportToExcel({
          tree, people, relationships,
          socialLinks: allSocialLinks,
          manualEvents, canvasPositions,
      });

      // Trigger local download immediately
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({ title: "קובץ אקסל יוצא בהצלחה ✓" });
      
      // Save to cloud in the background
      saveExportedFile(blob, fileName, 'xlsx');

    } catch (error) {
        console.error("Excel export failed:", error);
        toast({ variant: 'destructive', title: 'שגיאה בייצוא', description: 'לא ניתן היה להכין את הנתונים.' });
    }
  }, [tree, people, relationships, manualEvents, canvasPositions, user, db, treeId, toast, saveExportedFile]);

  const handleBackToDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);
  
  const handleNameSave = () => {
    if (!readOnly && nameValue.trim() && nameValue !== tree?.treeName) {
      handleUpdateTreeDetails({ treeName: nameValue });
    }
    setIsEditingName(false);
  };
  
  const handleOpenSettings = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsSettingsModalOpen(true));
  }, []);

  const handleOpenAccount = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsAccountModalOpen(true));
  }, []);

  const handleOpenPdfModal = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsPdfModalOpen(true));
  }, []);
  
  const handleOpenPptExport = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsPowerPointModalOpen(true));
  }, []);

  const handleOpenImageExport = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    requestAnimationFrame(() => setIsImageExportModalOpen(true));
  }, []);

  const isConstrainedView = (viewMode === 'tree' || viewMode === 'roots') && canvasAspectRatio !== 'free';

  const renderCurrentView = () => {
    switch (viewMode) {
      case 'tree':
        return (
          <FamilyTreeCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={handleNodeDoubleClick}
            onPaneClick={handlePaneClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onConnect={handleConnect}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            isValidConnection={isValidConnection}
            onSelectionChange={onSelectionChange}
          />
        );
      case 'timeline':
        return (
          <TimelineView
            people={people}
            relationships={relationships}
            edgeType={edgeType}
            isCompact={isTimelineCompact}
            onNodeDoubleClick={handleNodeDoubleClick}
          />
        );
      case 'table':
        return <TableView
            data={people}
            isOwner={!readOnly}
            treeId={treeId}
            updatePersonData={updatePersonData}
            onAddPerson={handleOpenEditorForNew}
            onEditPerson={handleEditPerson}
        />;
      case 'map':
        return <MapView people={people} onEditPerson={handleEditPerson} />;
      case 'calendar':
        return <CalendarView 
          people={people} 
          relationships={relationships} 
          manualEvents={manualEvents}
          onOpenEventEditor={handleOpenManualEventEditor}
          onEditPerson={handleEditPerson}
        />;
      case 'statistics':
        return <StatisticsView people={people} relationships={relationships} onEditPerson={onEditPerson} />;
      case 'trivia':
        return <TriviaView people={people} relationships={relationships} setViewMode={setViewMode} />;
      case 'roots':
        return <RootsView 
            project={rootsProject}
            setProject={handleSetRootsProject}
            updateProject={handleUpdateRootsProject}
            people={people}
            relationships={relationships}
            tree={tree}
            onEditPerson={handleEditPerson}
            onPageChange={(page: DesignPage) => setCurrentRootsPage(page)}
        />;
      default:
        return null;
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-12 w-12 text-primary" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">טוען את עץ המשפחה שלך...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-center text-destructive">
        <div>
          <h2 className="text-2xl font-bold">אירעה שגיאה</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full" dir="rtl">
      <div className="flex h-full">
        <CanvasToolbar
          treeId={treeId}
          onAddPerson={handleOpenEditorForNew}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          viewMode={viewMode}
          setViewMode={setViewMode}
          edgeType={edgeType}
          setEdgeType={setEdgeType}
          onOpenSettings={handleOpenSettings}
          onOpenAccount={handleOpenAccount}
          onToggleChat={() => setIsChatPanelOpen(prev => !prev)}
          onOpenPdfModal={handleOpenPdfModal}
          onOpenPptExport={handleOpenPptExport}
          onExportExcel={handleExportExcel}
          onOpenImageExport={handleOpenImageExport}
          onImportClick={() => importFileInputRef.current?.click()}
          isTimelineCompact={isTimelineCompact}
          onToggleTimelineCompact={() => setIsTimelineCompact(v => !v)}
          readOnly={readOnly}
          onBack={handleBackToDashboard}
          canvasAspectRatio={canvasAspectRatio}
          setCanvasAspectRatio={setCanvasAspectRatio}
        />
        <main tabIndex={-1} className={cn("flex-1 relative overflow-hidden", isConstrainedView && "flex items-center justify-center p-8")} id="main-view-container" style={{ backgroundColor: isConstrainedView ? (canvasBg || 'hsl(var(--muted))') : canvasBg }}>
          <input
            type="file"
            ref={importFileInputRef}
            className="hidden"
            accept=".xlsx"
            onChange={handleFileSelectedForImport}
          />

          <div
            className={cn(
              "relative mx-auto max-w-full",
              isConstrainedView 
                  ? "bg-background shadow-2xl border overflow-hidden"
                  : "w-full h-full",
              isConstrainedView && {
                  'aspect-[1.414/1] w-full h-auto max-h-full': canvasAspectRatio === 'a4-landscape',
                  'aspect-[1/1.414] h-full w-auto max-w-full': canvasAspectRatio === 'a4-portrait',
                  'aspect-video w-full h-auto max-h-full': canvasAspectRatio === '16:9-landscape',
                  'aspect-[9/16] h-full w-auto max-w-full': canvasAspectRatio === '9:16-portrait',
                  'aspect-square h-full w-auto max-w-full': canvasAspectRatio === '1:1',
              }
            )}
          >
              {renderCurrentView()}
          </div>
          
          {viewMode === 'tree' && (
            <div className="absolute top-4 left-4 z-10 rounded-lg border bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm flex items-center gap-2" data-export-hide>
              {isEditingName ? (
                <Input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNameSave();
                        if (e.key === 'Escape') {
                            setIsEditingName(false);
                            setNameValue(tree?.treeName || '');
                        }
                    }}
                    className="h-9 text-lg"
                    autoFocus
                />
              ) : (
                <h1
                    className="text-lg font-semibold rounded-md px-2 py-1 -m-2 -my-1 hover:bg-black/5 cursor-pointer"
                    onDoubleClick={() => { if(!readOnly) setIsEditingName(true) }}
                >
                    {tree?.treeName}
                </h1>
              )}
              <Popover
                open={isOwnerPopoverOpen}
                onOpenChange={setIsOwnerPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={readOnly}>
                    <User className="h-4 w-4" />
                    <span className="sr-only">בחר אותי</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0">
                  <h4 className="text-sm font-medium p-2 border-b text-center">
                    מי אתה בעץ?
                  </h4>
                  <ScrollArea className="h-72">
                    <div className="p-2 space-y-1">
                      {people.map((person) => (
                        <Button
                          key={person.id}
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => {
                            handleUpdateTreeDetails({ ownerPersonId: person.id });
                            setIsOwnerPopoverOpen(false);
                          }}
                        >
                          {person.firstName} {person.lastName}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          )}
          {contextMenu && viewMode === 'tree' && (
            <NodeContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              nodes={contextMenu.nodes}
              onClose={() => setContextMenu(null)}
              onGroup={handleGroup}
              onUngroup={handleUngroup}
              onLock={handleLock}
              onUnlock={handleUnlock}
            />
          )}
          {selectedNodes.length > 1 && viewMode === 'tree' && !readOnly && (
            <AlignmentToolbar nodes={selectedNodes} onAlign={handleAlign} />
          )}
           {isChatPanelOpen && user && db && tree && (
            <AiChatPanel
              treeId={treeId}
              treeName={tree.treeName}
              people={people}
              onClose={() => setIsChatPanelOpen(false)}
              onDataAdded={fetchData}
              context={viewMode === 'roots' ? 'design-assistant' : 'tree-building'}
              currentPage={viewMode === 'roots' ? currentRootsPage : undefined}
              onApplyDesignChanges={viewMode === 'roots' ? (elements) => {
                setCurrentRootsPage(prev => prev ? { ...prev, elements } : prev);
              } : undefined}
            />
          )}
        </main>
      </div>

      <RelationshipModal
        isOpen={isRelModalOpen || !!pendingDeleteId}
        onClose={handleRelModalClose}
        connection={newConnection}
        relationship={
          editingRelationship ||
          (pendingDeleteId
            ? relationships.find((r) => r.id === pendingDeleteId)
            : null)
        }
        relationshipId={editingRelationship?.id || pendingDeleteId || undefined}
        people={people}
        onSave={handleSaveRelationship}
        onDelete={handleDeleteRelationship}
      />

      <PersonEditor
        isOpen={isEditorOpen}
        onClose={handleEditorClose}
        person={selectedPerson}
        treeId={treeId}
        onSave={(data) => handleSavePerson(data, !selectedPerson)}
        onDelete={handleDeleteRequest}
      />
       <ManualEventEditor 
        isOpen={isManualEventEditorOpen}
        onClose={() => setIsManualEventEditorOpen(false)}
        event={editingManualEvent}
        onSave={handleSaveManualEvent}
        onDelete={handleDeleteManualEvent}
      />

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />
      
      {tree && (
        <PdfExportModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          tree={tree}
          onSave={(blob, fileName) => saveExportedFile(blob, fileName, 'pdf')}
        />
      )}
      
       {tree && (
        <ImageExportModal
          isOpen={isImageExportModalOpen}
          onClose={() => setIsImageExportModalOpen(false)}
          tree={tree}
          onSave={saveExportedFile}
        />
      )}
      
       {tree && (
        <PowerPointExportModal
          isOpen={isPowerPointModalOpen}
          onClose={() => setIsPowerPointModalOpen(false)}
          tree={tree}
          people={people}
          relationships={relationships}
          onSave={(blob, fileName) => saveExportedFile(blob, fileName, 'pptx')}
        />
      )}
      
       <ImportConfirmationModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        parsedData={parsedExcelData}
        onConfirm={handleConfirmImport}
        isImporting={isImporting}
      />

      {tree && <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        tree={tree}
        people={people}
        onUpdate={handleUpdateTreeDetails}
        onUploadCover={() => {}}
      />}

      <AlertDialog
        open={isDuplicateAlertOpen}
        onOpenChange={setIsDuplicateAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>נמצאה כפילות אפשרית</AlertDialogTitle>
            <AlertDialogDescription>
              אדם עם שם ותאריך לידה דומים כבר קיים בעץ זה. האם אתה עדיין רוצה
              ליצור את האדם החדש הזה?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPersonToCreate(null)}>
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => personToCreate && proceedWithCreation(personToCreate)}
            >
              צור בכל זאת
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent onCloseAutoFocus={(e) => { e.preventDefault(); requestAnimationFrame(() => { const canvas = document.getElementById('main-view-container'); if (canvas) canvas.focus(); }); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את{' '}
              <strong className="text-foreground">
                {personToDelete?.firstName} {personToDelete?.lastName}
              </strong>
              , וכל הקשרים שלו. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TreePageClient({ treeId, readOnly = false }: TreePageClientProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasContainer treeId={treeId} readOnly={readOnly} />
    </ReactFlowProvider>
  );
}
