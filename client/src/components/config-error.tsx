export function ConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Konfigurationsfehler
          </h1>
          <p className="text-gray-600 mb-4">
            Die Supabase-Konfiguration fehlt. Bitte setzen Sie die folgenden Environment-Variablen in Render:
          </p>
          <div className="bg-gray-100 rounded-lg p-4 mb-4 text-left">
            <code className="text-sm text-gray-800">
              VITE_SUPABASE_URL<br />
              VITE_SUPABASE_ANON_KEY
            </code>
          </div>
          <p className="text-sm text-gray-500">
            Diese Variablen müssen während des Builds verfügbar sein, da Vite sie zur Build-Zeit in den Code einbettet.
          </p>
        </div>
      </div>
    </div>
  );
}

