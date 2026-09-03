import { useEffect, useRef, useState } from 'react';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import type { Course } from '../types';
import { parseLadokText } from '../ladokParser';
import { LADOK_URL, LADOK_MESSAGE_SOURCE, getBookmarkletHref } from '../ladokBookmarklet';

export function LadokImport({ onImport }: { onImport: (courses: Course[], studentName?: string | null) => void }) {
  const [popupOpened, setPopupOpened] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [error, setError] = useState('');
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || e.data.source !== LADOK_MESSAGE_SOURCE || typeof e.data.text !== 'string') return;

      const { courses, studentName } = parseLadokText(e.data.text);
      if (courses.length === 0) {
        setError('Got a page from Ladok, but couldn\'t find any graded courses on it. Make sure you\'re on the "Studieresultat" page before clicking the bookmarklet.');
        return;
      }
      setError('');
      setImported(courses.length);
      onImport(courses, studentName);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onImport]);

  function openLadok() {
    popupRef.current = window.open(LADOK_URL, 'kth-grades-ladok', 'width=1100,height=800');
    setPopupOpened(true);
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-medium text-gray-900 text-sm">Connect via Ladok</h3>
        <p className="text-xs text-gray-500 mt-1">
          No password is ever shared with this app. You log in to Ladok directly, in your own tab, exactly as you
          normally would (including your KTH two-factor step). A bookmarklet you run on the Ladok page afterwards
          reads the already-rendered results and sends them here.
        </p>
      </div>

      <ol className="space-y-3 text-sm text-gray-700">
        <li className="flex gap-2">
          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium flex items-center justify-center">1</span>
          <span>
            Drag this to your bookmarks bar:{' '}
            <a
              href={getBookmarkletHref()}
              onClick={(e) => e.preventDefault()}
              className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium cursor-grab active:cursor-grabbing select-none"
              title="Drag me to your bookmarks bar"
            >
              📥 Send to kth-grades
            </a>
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium flex items-center justify-center">2</span>
          <span>
            <button onClick={openLadok} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
              Open Ladok and log in <ExternalLink size={13} />
            </button>{' '}
            in the new tab, then navigate to <em>Studieresultat</em>.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium flex items-center justify-center">3</span>
          <span>Click the "📥 Send to kth-grades" bookmark while on that page. This tab updates automatically.</span>
        </li>
      </ol>

      {popupOpened && imported === null && !error && (
        <p className="text-xs text-gray-400">Waiting for data from the Ladok tab…</p>
      )}
      {imported !== null && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle2 size={16} /> Imported {imported} course{imported === 1 ? '' : 's'} from Ladok.
        </div>
      )}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
      )}
    </div>
  );
}
