import { Navigate } from 'react-router-dom';
import { getLastSectionPath, type NavSection } from '../../lib/sectionNavMemory';

/** Redirect section index to last visited sub-route (or default). */
export function SectionIndexRedirect({ section }: { section: NavSection }) {
  return <Navigate to={getLastSectionPath(section)} replace />;
}
