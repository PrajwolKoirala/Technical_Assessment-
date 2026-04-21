/**
 * Central registry of all adapters.
 * To add a new adapter: import it and call registry.register(new YourAdapter()).
 */

import { AdapterRegistry } from "./base";
import { WhoisAdapter } from "./whois";
import { GitHubAdapter } from "./github";
import { HibpAdapter } from "./hibp";
import { NewsAdapter } from "./news";
import { SocialAdapter } from "./social";
import { RegulatoryAdapter } from "./regulatory";

export const registry = new AdapterRegistry()
  .register(new SocialAdapter())
  .register(new WhoisAdapter())
  .register(new GitHubAdapter())
  .register(new HibpAdapter())
  .register(new NewsAdapter())
  .register(new RegulatoryAdapter());

export { BaseAdapter } from "./base";
