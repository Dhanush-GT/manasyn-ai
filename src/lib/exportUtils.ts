import JSZip from 'jszip';
import type { ReflectionEntry, Milestone, LocationTag, UserProfile, ExportOptions, ExportManifest } from '../types';

/**
 * Filter reflections by date scope, draft status, tags, and places
 */
export function filterExportEntries(
  entries: ReflectionEntry[],
  options: ExportOptions
): ReflectionEntry[] {
  const now = new Date();
  const nowMs = now.getTime();

  return entries.filter((entry) => {
    // 1. Filter out empty reflections / drafts if requested
    if (options.excludeDrafts) {
      if (!entry.messages || entry.messages.length === 0) {
        return false;
      }
      const hasMeaningfulContent = entry.messages.some((m) => m.content && m.content.trim().length > 0);
      if (!hasMeaningfulContent) return false;
    }

    // 2. Date Scope Filtering
    const entryDate = new Date(entry.createdAt);
    const entryMs = entryDate.getTime();

    if (options.dateScope === '30_days') {
      const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
      if (entryMs < thirtyDaysAgo) return false;
    } else if (options.dateScope === '90_days') {
      const ninetyDaysAgo = nowMs - 90 * 24 * 60 * 60 * 1000;
      if (entryMs < ninetyDaysAgo) return false;
    } else if (options.dateScope === 'custom') {
      if (options.startDate) {
        const startMs = new Date(options.startDate).getTime();
        if (entryMs < startMs) return false;
      }
      if (options.endDate) {
        const endMs = new Date(options.endDate).getTime() + 24 * 60 * 60 * 1000; // inclusive
        if (entryMs > endMs) return false;
      }
    }

    // 3. Tag Filtering
    if (options.selectedTagFilter && options.selectedTagFilter !== 'all') {
      if (!entry.tags || !entry.tags.includes(options.selectedTagFilter)) {
        return false;
      }
    }

    // 4. Place Filtering
    if (options.selectedPlaceFilter && options.selectedPlaceFilter !== 'all') {
      if (!entry.location || entry.location.placeName !== options.selectedPlaceFilter) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Generates an automated README.md manifest file documenting the export
 */
export function generateExportManifest(
  entries: ReflectionEntry[],
  commitments: Milestone[],
  places: LocationTag[],
  options: ExportOptions,
  user: UserProfile
): ExportManifest {
  const totalMessages = entries.reduce((acc, e) => acc + (e.messages?.length || 0), 0);
  
  const includedCategories: string[] = ['Reflections', 'Messages'];
  const excludedCategories: string[] = [];

  if (options.includeCommitments) {
    includedCategories.push('Commitments & Next Steps');
  } else {
    excludedCategories.push('Commitments & Next Steps');
  }

  if (options.includePlaces) {
    includedCategories.push(options.includeExactCoordinates ? 'Places (with Coordinates)' : 'Places (Names & Categories Only)');
  } else {
    excludedCategories.push('Places & Locations');
  }

  if (options.includeInsights) {
    includedCategories.push('Saved Insights & Clarity Cards');
  } else {
    excludedCategories.push('Saved Insights & Clarity Cards');
  }

  if (options.includeTags) {
    includedCategories.push('Tags');
  } else {
    excludedCategories.push('Tags');
  }

  if (options.excludeDrafts) {
    excludedCategories.push('Empty Reflections / Drafts');
  }

  return {
    exportDate: new Date().toISOString(),
    schemaVersion: '1.0.0',
    appVersion: '1.2.0',
    totalReflections: entries.length,
    totalMessages,
    totalCommitments: options.includeCommitments ? commitments.length : 0,
    totalPlaces: options.includePlaces ? places.length : 0,
    dateRange: {
      scope: options.dateScope,
      from: options.startDate,
      to: options.endDate,
    },
    includedCategories,
    excludedCategories,
    exactCoordinatesIncluded: options.includePlaces && options.includeExactCoordinates,
  };
}

/**
 * Format the manifest object as a human-readable Markdown README.md
 */
export function formatManifestMarkdown(
  manifest: ExportManifest,
  user: UserProfile,
  entries: ReflectionEntry[]
): string {
  let md = `# Manasyn Journal Export Manifest\n\n`;
  md += `**Export Date:** ${new Date(manifest.exportDate).toLocaleString()}\n`;
  md += `**User:** ${user.displayName || user.email || 'Authenticated User'}\n`;
  md += `**Schema Version:** \`${manifest.schemaVersion}\` | **App Version:** \`${manifest.appVersion}\`\n\n`;
  md += `---\n\n`;

  md += `## 📊 Archive Summary\n\n`;
  md += `- **Total Reflections Included:** ${manifest.totalReflections}\n`;
  md += `- **Total Messages / Dialogue Turns:** ${manifest.totalMessages}\n`;
  md += `- **Commitments Exported:** ${manifest.totalCommitments}\n`;
  md += `- **Places Exported:** ${manifest.totalPlaces}\n`;
  md += `- **Date Scope:** \`${manifest.dateRange.scope.replace('_', ' ').toUpperCase()}\``;
  if (manifest.dateRange.from || manifest.dateRange.to) {
    md += ` (${manifest.dateRange.from || 'Start'} to ${manifest.dateRange.to || 'Present'})`;
  }
  md += `\n- **Location Privacy:** ${manifest.exactCoordinatesIncluded ? '⚠️ Exact coordinates included upon explicit user request' : '🔒 Exact coordinates omitted for privacy'}\n\n`;

  md += `## 📁 Package Contents\n\n`;
  md += `\`\`\`text\n`;
  md += `manasyn-export/\n`;
  md += `├── README.md (This Manifest)\n`;
  md += `├── reflections/\n`;
  entries.slice(0, 10).forEach((entry) => {
    const dateStr = entry.createdAt.slice(0, 10);
    const sanitizedTitle = (entry.title || 'untitled')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40)
      .replace(/-+$/, '');
    md += `│   ├── ${dateStr}-${sanitizedTitle}.md\n`;
  });
  if (entries.length > 10) {
    md += `│   └── ... (${entries.length - 10} more reflections)\n`;
  }
  if (manifest.totalCommitments > 0) {
    md += `├── commitments.md\n`;
  }
  if (manifest.totalPlaces > 0) {
    md += `└── places.md\n`;
  }
  md += `\`\`\`\n\n`;

  md += `## 🔒 Data Inclusions & Privacy Controls\n\n`;
  md += `### Included Categories\n`;
  manifest.includedCategories.forEach((cat) => {
    md += `- ✅ ${cat}\n`;
  });
  md += `\n### Excluded Categories\n`;
  if (manifest.excludedCategories.length > 0) {
    manifest.excludedCategories.forEach((cat) => {
      md += `- ⛔ ${cat}\n`;
    });
  } else {
    md += `- *(None — Full scope exported)*\n`;
  }

  md += `\n---\n*Generated locally with Manasyn Data Portability Engine.*\n`;
  return md;
}

/**
 * Format a single reflection entry into clean Markdown
 */
export function formatSingleReflectionMarkdown(
  entry: ReflectionEntry,
  options: ExportOptions
): string {
  const created = new Date(entry.createdAt).toLocaleString();
  const updated = new Date(entry.updatedAt).toLocaleString();

  let md = `---\n`;
  md += `title: "${(entry.title || 'Untitled Reflection').replace(/"/g, '\\"')}"\n`;
  md += `date: "${entry.createdAt}"\n`;
  md += `last_modified: "${entry.updatedAt}"\n`;
  if (options.includeTags && entry.tags && entry.tags.length > 0) {
    md += `tags: [${entry.tags.map((t) => `"${t}"`).join(', ')}]\n`;
  }
  if (options.includePlaces && entry.location?.placeName) {
    md += `place: "${entry.location.placeName.replace(/"/g, '\\"')}"\n`;
    if (entry.location.category) md += `place_category: "${entry.location.category}"\n`;
    if (options.includeExactCoordinates && typeof entry.location.latitude === 'number' && typeof entry.location.longitude === 'number') {
      md += `latitude: ${entry.location.latitude}\n`;
      md += `longitude: ${entry.location.longitude}\n`;
    }
  }
  md += `---\n\n`;

  md += `# ${entry.title || 'Untitled Reflection'}\n\n`;
  md += `*Recorded on ${created} (Updated ${updated})*\n\n`;

  if (options.includePlaces && entry.location?.placeName) {
    md += `📍 **Place:** ${entry.location.placeName}`;
    if (entry.location.category) md += ` *(${entry.location.category})*`;
    if (entry.location.formattedAddress) md += ` — ${entry.location.formattedAddress}`;
    if (options.includeExactCoordinates && typeof entry.location.latitude === 'number' && typeof entry.location.longitude === 'number') {
      md += ` [${entry.location.latitude.toFixed(4)}°, ${entry.location.longitude.toFixed(4)}°]`;
    }
    md += `\n\n`;
  }

  if (options.includeTags && entry.tags && entry.tags.length > 0) {
    md += `🏷️ **Tags:** ${entry.tags.map((t) => `\`#${t}\``).join(' ')}\n\n`;
  }

  md += `---\n\n## Dialogue\n\n`;

  if (!entry.messages || entry.messages.length === 0) {
    md += `*(No dialogue recorded in this reflection)*\n\n`;
  } else {
    entry.messages.forEach((msg, idx) => {
      const speaker = msg.role === 'user' ? 'You' : 'Manasyn';
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      md += `### ${idx + 1}. ${speaker} (${time})\n\n`;
      md += `${msg.content}\n\n`;

      if (options.includeInsights && msg.clarityCard) {
        md += `> **💡 Saved Insight & Clarity**\n`;
        if (msg.clarityCard.whatIHeard) {
          md += `> - **Core Context:** ${msg.clarityCard.whatIHeard}\n`;
        }
        if (msg.clarityCard.coreDilemma) {
          md += `> - **Key Realization:** ${msg.clarityCard.coreDilemma}\n`;
        }
        if (msg.clarityCard.suggestedNextStep) {
          md += `> - **Suggested Next Step:** ${msg.clarityCard.suggestedNextStep}\n`;
        }
        if (options.includeCommitments && msg.clarityCard.extractedCommitment) {
          md += `> - **Commitment:** ${msg.clarityCard.extractedCommitment.title} (${msg.clarityCard.extractedCommitment.category || 'personal'})\n`;
        }
        md += `\n`;
      }
    });
  }

  return md;
}

/**
 * Format commitments file
 */
export function formatCommitmentsMarkdown(commitments: Milestone[]): string {
  let md = `# Commitments & Next Steps\n\n`;
  md += `*Exported on ${new Date().toLocaleString()}*\n`;
  md += `*Total Commitments:* ${commitments.length}\n\n---\n\n`;

  if (commitments.length === 0) {
    md += `*(No commitments recorded)*\n`;
    return md;
  }

  const grouped: Record<string, Milestone[]> = {};
  commitments.forEach((m) => {
    const cat = m.category || 'personal';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(m);
  });

  Object.entries(grouped).forEach(([cat, list]) => {
    md += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n\n`;
    list.forEach((m) => {
      const check = m.status === 'achieved' ? '[x]' : '[ ]';
      md += `- ${check} **${m.title}**`;
      if (m.targetTimeframe) md += ` *(Target: ${m.targetTimeframe})*`;
      md += `\n`;
      if (m.notes) md += `  - *Notes:* ${m.notes}\n`;
      if (m.createdAt) md += `  - *Created:* ${new Date(m.createdAt).toLocaleDateString()}\n`;
    });
    md += `\n`;
  });

  return md;
}

/**
 * Format places file
 */
export function formatPlacesMarkdown(places: LocationTag[], includeExactCoordinates: boolean): string {
  let md = `# Saved Places\n\n`;
  md += `*Exported on ${new Date().toLocaleString()}*\n`;
  md += `*Total Places:* ${places.length}\n\n---\n\n`;

  if (places.length === 0) {
    md += `*(No saved places recorded)*\n`;
    return md;
  }

  places.forEach((p, idx) => {
    md += `## ${idx + 1}. ${p.placeName}\n\n`;
    if (p.category) md += `- **Category:** ${p.category}\n`;
    if (p.precision) md += `- **Precision:** ${p.precision}\n`;
    if (p.formattedAddress) md += `- **Address / Area:** ${p.formattedAddress}\n`;
    if (p.notes) md += `- **Notes:** ${p.notes}\n`;
    if (includeExactCoordinates && typeof p.latitude === 'number' && typeof p.longitude === 'number') {
      md += `- **Coordinates:** \`${p.latitude.toFixed(5)}°, ${p.longitude.toFixed(5)}°\`\n`;
    }
    if (p.taggedAt) md += `- **Saved on:** ${new Date(p.taggedAt).toLocaleDateString()}\n`;
    md += `\n`;
  });

  return md;
}

/**
 * Creates and triggers download of a ZIP archive containing all markdown files & manifest
 */
export async function downloadMarkdownZipArchive(
  entries: ReflectionEntry[],
  commitments: Milestone[],
  places: LocationTag[],
  options: ExportOptions,
  user: UserProfile
): Promise<void> {
  const zip = new JSZip();
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rootFolderName = `manasyn-export-${timestampStr}`;
  const rootFolder = zip.folder(rootFolderName) || zip;

  const manifest = generateExportManifest(entries, commitments, places, options, user);
  const readmeContent = formatManifestMarkdown(manifest, user, entries);

  // 1. Add README.md manifest
  rootFolder.file('README.md', readmeContent);

  // 2. Add reflections/ folder
  const reflectionsFolder = rootFolder.folder('reflections');
  if (reflectionsFolder) {
    entries.forEach((entry, idx) => {
      const dateStr = (entry.createdAt || new Date().toISOString()).slice(0, 10);
      const sanitizedTitle = (entry.title || `reflection-${idx + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40)
        .replace(/^-+|-+$/g, '') || `reflection-${idx + 1}`;
      
      const fileName = `${dateStr}-${sanitizedTitle}.md`;
      const fileContent = formatSingleReflectionMarkdown(entry, options);
      reflectionsFolder.file(fileName, fileContent);
    });
  }

  // 3. Add commitments.md if selected
  if (options.includeCommitments && commitments.length > 0) {
    rootFolder.file('commitments.md', formatCommitmentsMarkdown(commitments));
  }

  // 4. Add places.md if selected
  if (options.includePlaces && places.length > 0) {
    rootFolder.file('places.md', formatPlacesMarkdown(places, options.includeExactCoordinates));
  }

  // Generate ZIP blob and trigger download
  const contentBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(contentBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${rootFolderName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Creates and triggers download of a structured JSON export
 */
export function downloadJsonExport(
  entries: ReflectionEntry[],
  commitments: Milestone[],
  places: LocationTag[],
  options: ExportOptions,
  user: UserProfile
): void {
  const timestampStr = new Date().toISOString().slice(0, 10);
  const manifest = generateExportManifest(entries, commitments, places, options, user);

  const cleanReflections = entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    tags: options.includeTags ? entry.tags : undefined,
    location: options.includePlaces && entry.location ? {
      placeName: entry.location.placeName,
      category: entry.location.category,
      precision: entry.location.precision,
      formattedAddress: entry.location.formattedAddress,
      latitude: options.includeExactCoordinates ? entry.location.latitude : undefined,
      longitude: options.includeExactCoordinates ? entry.location.longitude : undefined,
    } : undefined,
    messages: entry.messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      mode: m.mode,
      clarityCard: options.includeInsights ? m.clarityCard : undefined,
    })),
  }));

  const payload = {
    manifest,
    exportedAt: new Date().toISOString(),
    user: {
      id: user.uid,
      email: user.email,
      displayName: user.displayName,
    },
    reflections: cleanReflections,
    commitments: options.includeCommitments ? commitments : undefined,
    places: options.includePlaces ? places.map((p) => ({
      id: p.id,
      placeName: p.placeName,
      category: p.category,
      precision: p.precision,
      formattedAddress: p.formattedAddress,
      notes: p.notes,
      latitude: options.includeExactCoordinates ? p.latitude : undefined,
      longitude: options.includeExactCoordinates ? p.longitude : undefined,
    })) : undefined,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `manasyn-export-${timestampStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
