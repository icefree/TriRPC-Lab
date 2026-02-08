import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const useGitHubPagesBase = process.env.GITHUB_ACTIONS === 'true' && Boolean(repoName)

  return {
    plugins: [react()],
    base: useGitHubPagesBase ? `/${repoName}/` : '/',
  }
})
