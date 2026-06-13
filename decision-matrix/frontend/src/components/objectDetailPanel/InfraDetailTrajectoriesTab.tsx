import { InfraWellTrajectorySection } from './InfraWellTrajectorySection';
import type { InfraObject } from '../../lib/api';

interface InfraDetailTrajectoriesTabProps {
  showTrajectoriesSection: boolean;
  projectId: string | null;
  infraObject: InfraObject | null;
  infraObjects: InfraObject[];
  readOnly: boolean;
}

export function InfraDetailTrajectoriesTab({
  showTrajectoriesSection,
  projectId,
  infraObject,
  infraObjects,
  readOnly,
}: InfraDetailTrajectoriesTabProps) {
  if (!showTrajectoriesSection || !projectId || !infraObject) {
    return null;
  }

  return (
    <InfraWellTrajectorySection
      projectId={projectId}
      infraObject={infraObject}
      infraObjects={infraObjects}
      readOnly={readOnly}
    />
  );
}
