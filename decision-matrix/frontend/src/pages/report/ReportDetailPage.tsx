import { ReportEditorPage } from './ReportEditorPage';

export function ReportNewPage() {
  return <ReportEditorPage mode="new" />;
}

export function ReportDetailPage() {
  return <ReportEditorPage mode="edit" />;
}
