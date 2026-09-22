
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react-swc';
  import tailwindcss from '@tailwindcss/vite';
  import path from 'path';

  const serverOnly = (file: string) => ['private', 'supabase', 'scripts', '.claude'].some(dir => {
    const root = path.resolve(__dirname, dir);
    return file === root || file.startsWith(root + path.sep);
  });

  export default defineConfig({
    plugins: [react(), tailwindcss(), {
      name: 'private-puzzle-boundary',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          try {
            const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
            const file = pathname.startsWith('/@fs/')
              ? path.resolve('/', pathname.slice(5)) : path.resolve(__dirname, '.' + pathname);
            if (serverOnly(file)) {
              response.statusCode = 403;
              response.end('Server-only files are unavailable.');
              return;
            }
            next();
          } catch { response.statusCode = 400; response.end('Invalid request path.'); }
        });
      },
      load(id) {
        const file = id.split('?')[0];
        if (serverOnly(file)) {
          throw new Error('Server-only files cannot be imported into the browser app');
        }
      },
    }],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
    },
    server: {
      port: 3000,
      open: false,
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/private/**', '**/supabase/**', '**/scripts/**', '**/.claude/**'] },
    },
  });
