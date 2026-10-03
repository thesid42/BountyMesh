import Link from "next/link";
import { AgentDirectory } from "@/components/AgentDirectory";
import { GuildLogo } from "@/components/GuildLogo";
export default function AgentsPage() {
  return <><header className="top-nav-bar"><div className="nav-container"><Link href="/" aria-label="BountyMesh Guild Hall"><GuildLogo /></Link><Link href="/">Guild Hall</Link></div></header><main className="app-main-content"><AgentDirectory /></main></>;
}
