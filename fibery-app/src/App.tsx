import {useEffect, useRef} from "react";
import "./palace.css";
import {MARKUP} from "./markup";
import {startPalace} from "./engine";
import {PalaceApi} from "./palaceApi";

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (host.current) startPalace(PalaceApi);
  }, []);
  return <div ref={host} dangerouslySetInnerHTML={{__html: MARKUP}} />;
}
