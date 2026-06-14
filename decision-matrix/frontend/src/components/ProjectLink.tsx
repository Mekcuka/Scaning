import { Link, type LinkProps } from 'react-router-dom';

import { useProjectPathBuilder } from '../hooks/useProjectPath';
import { isGlobalAppPath } from '../lib/projectRoutes';

export function ProjectLink({ to, ...rest }: LinkProps) {
  const build = useProjectPathBuilder();
  const resolved =
    typeof to === 'string'
      ? isGlobalAppPath(to)
        ? to
        : build(to)
      : to;
  return <Link to={resolved} {...rest} />;
}
