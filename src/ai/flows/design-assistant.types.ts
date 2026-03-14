import { z } from 'genkit';

// Defines the style properties for a design element.
const DesignElementStyleSchema = z.object({
  opacity: z.number().optional(),
  borderRadius: z.number().optional(),
  borderColor: z.string().optional(),
  borderWidth: z.number().optional(),
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.enum(['normal', 'bold', 'extrabold']).optional(),
  fontFamily: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  lineHeight: z.number().optional(),
  shapeType: z.enum(['rectangle', 'rounded_rectangle', 'circle', 'ellipse', 'triangle', 'star', 'star6', 'diamond', 'pentagon', 'hexagon', 'octagon', 'heart', 'arrow_right', 'arrow_left', 'speech_bubble', 'banner', 'cross', 'parallelogram', 'trapezoid', 'line_h']).optional(),
  lineType: z.enum(['straight', 'dashed', 'dotted', 'pcb', 'wavy']).optional(),
}).deepPartial();

// Defines a single element on a presentation page.
const DesignElementSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'shape', 'person_card', 'icon', 'connection_line', 'photo_placeholder']),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  zIndex: z.number(),
  content: z.string().optional(),
  personId: z.string().optional(),
  fromElementId: z.string().optional(),
  toElementId: z.string().optional(),
  style: DesignElementStyleSchema.optional(),
});
export type DesignElement = z.infer<typeof DesignElementSchema>;

// Input schema for the design assistant AI flow.
export const DesignAssistantInputSchema = z.object({
  elements: z.array(DesignElementSchema).describe("The array of design elements on the current page."),
  prompt: z.string().describe("The user's instruction for what to change."),
});
export type DesignAssistantInput = z.infer<typeof DesignAssistantInputSchema>;

// Output schema for the design assistant AI flow.
export const DesignAssistantOutputSchema = z.object({
  updatedElements: z.array(DesignElementSchema).describe("The complete, modified array of all design elements for the page."),
});
export type DesignAssistantOutput = z.infer<typeof DesignAssistantOutputSchema>;
