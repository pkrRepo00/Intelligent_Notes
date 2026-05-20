import { Note } from '../types';

export interface AppPlugin {
  id: string;
  name: string;
  onInit?: (api: PluginAPI) => void;
  onNoteCreate?: (note: Partial<Note>) => Partial<Note>;
  onNoteSave?: (note: Note) => Note;
  onDestroy?: () => void;
}

export interface PluginAPI {
  getNotes: () => Note[];
  addTag: (noteId: string, tag: string) => void;
  showNotification: (msg: string) => void;
}

class PluginManagerClass {
  private plugins: Map<string, AppPlugin> = new Map();
  private api: PluginAPI = {
    getNotes: () => [],
    addTag: () => {},
    showNotification: (msg) => console.log('Plugin Notification:', msg)
  };

  register(plugin: AppPlugin) {
    if (this.plugins.has(plugin.id)) return;
    this.plugins.set(plugin.id, plugin);
    if (plugin.onInit) {
      try { plugin.onInit(this.api); } catch (e) { console.error('Plugin init error:', plugin.id, e); }
    }
  }

  setAPIHooks(hooks: Partial<PluginAPI>) {
    this.api = { ...this.api, ...hooks };
  }

  runOnNoteSave(note: Note): Note {
    let modified = { ...note };
    for (const plugin of this.plugins.values()) {
      if (plugin.onNoteSave) {
        try {
          modified = { ...modified, ...plugin.onNoteSave(modified) };
        } catch (e) {
             console.error('Plugin onNoteSave error', e);
        }
      }
    }
    return modified;
  }
}

export const PluginManager = new PluginManagerClass();

// Default built-in AI enhancer plugin concept
PluginManager.register({
  id: 'auto-tagger',
  name: 'Auto Tagger',
  onNoteSave: (note) => {
    // Basic local fallback tagger if AI didn't catch categories
    if (!note.categories || note.categories.length === 0) {
      if (note.content && (note.content.toLowerCase().includes('todo') || note.content.toLowerCase().includes('- [ ]'))) {
        return { ...note, categories: ["Tasks"] };
      }
    }
    return note;
  }
});
