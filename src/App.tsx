import { useRoutes } from "react-router-dom";
import { featureRoutes } from "./routes/featureRoutes";

export default function App() {
  return <>{useRoutes(featureRoutes)}</>;
}
