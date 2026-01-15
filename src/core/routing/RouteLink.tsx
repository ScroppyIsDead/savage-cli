import { Link, type LinkProps } from "react-router-dom";
import { getRoutePathByName } from "../../routes/routes.generated";

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
      const message = `RouteLink sent route name "${name}" that is not registered. Check that the corresponding feature exports that route.`;
      if (import.meta.env.DEV) {
        console.error(message);
      }
      throw new Error(message);
    }
    return <Link to={routePath} {...rest} />;
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
