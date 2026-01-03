import { Link, type LinkProps } from "react-router-dom";
import { getRoutePathByName } from "./featureRegistry";

type RouteLinkPropsBase = Omit<LinkProps, "to">;

type RouteLinkByName = RouteLinkPropsBase & {
  name: string;
  toPath?: never;
};

type RouteLinkByPath = RouteLinkPropsBase & {
  name?: undefined;
  toPath: LinkProps["to"];
};

export type RouteLinkProps = RouteLinkByName | RouteLinkByPath;

function hasRouteName(value: RouteLinkProps): value is RouteLinkByName {
  return typeof value.name === "string";
}

export default function RouteLink(props: RouteLinkProps) {
  if (hasRouteName(props)) {
    const { name, ...rest } = props;
    const routePath = getRoutePathByName(name);
    if (!routePath) {
      console.warn(`Route name "${name}" not registered`);
    }
    return <Link to={routePath ?? name} {...rest} />;
  }

  const { toPath, ...rest } = props;
  return <Link to={toPath} {...rest} />;
}

export function useRouteByName(name: string) {
  return getRoutePathByName(name);
}

export function resolveRoutePath(name: string) {
  return getRoutePathByName(name);
}
