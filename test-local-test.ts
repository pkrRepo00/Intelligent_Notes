import { fetch as uFetch, Agent } from 'undici';
import * as dns from 'dns';

// Wait, the review said array vs string type mismatch in DNS lookup callback. Let me verify the undici logic
