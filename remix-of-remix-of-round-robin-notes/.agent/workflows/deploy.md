---
description: Build and deploy the application
---

1. Build the application for production
// turbo
2. Run `npm run build`

3. Deploy the artifacts
   - The build output is located in the `dist/` directory.
   - **Netlify**: Drag and drop the `dist` folder to [app.netlify.com/drop](https://app.netlify.com/drop).
   - **Vercel**: Run `npx vercel deploy` if you have the CLI, or import your repo on the Vercel dashboard.
   - **Supabase**: If you are using Supabase hosting, follow their specific guide.
