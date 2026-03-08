# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Firebase Storage CORS Setup

To allow file uploads from the browser to Firebase Storage during local development, you may need to update the CORS configuration for your storage bucket.

1.  **Install `gsutil`:** Make sure you have the [Google Cloud CLI installed](https://cloud.google.com/sdk/docs/install), which includes the `gsutil` tool.

2.  **Authenticate:** Log in with your Google account:
    ```bash
    gcloud auth login
    ```

3.  **Set CORS Configuration:** Run the following command from the root of this project, replacing `[your-project-id]` with your actual Firebase project ID.
    ```bash
    gsutil cors set cors.json gs://[your-project-id].appspot.com
    ```
