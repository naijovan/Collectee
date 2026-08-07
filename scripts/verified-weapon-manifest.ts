export interface VerifiedWeaponSpec {
  id: string;
  source: string;
  sourceKind: 'transparent' | 'dark-background';
  alphaMask?: string;
  edgeColor: string;
  maxDepth: number;
}

/**
 * Catalogue items with at least one verified ownership claim that are guns or
 * blades. Characters and charms are intentionally excluded.
 */
export const VERIFIED_WEAPONS: readonly VerifiedWeaponSpec[] = [
  {
    id: 'codm-ak117-cordite-storm',
    source: 'assets/collectee/items/codm-ak117-cordite-storm.png',
    sourceKind: 'dark-background',
    edgeColor: '#A83418',
    maxDepth: 0.066,
  },
  {
    id: 'codm-dlq33-lightbringer',
    source:
      'assets/collectee/trellis-inputs/crown-jewels-weapons/codm-dlq33-lightbringer.png',
    sourceKind: 'transparent',
    edgeColor: '#D4AE5C',
    maxDepth: 0.052,
  },
  {
    id: 'codm-drh-cerberus',
    source: 'assets/collectee/items/codm-drh-cerberus.png',
    sourceKind: 'dark-background',
    edgeColor: '#8C6A47',
    maxDepth: 0.066,
  },
  {
    id: 'codm-fennec-ascended',
    source:
      'assets/collectee/trellis-inputs/crown-jewels-weapons/codm-fennec-ascended.png',
    sourceKind: 'transparent',
    edgeColor: '#C6943D',
    maxDepth: 0.066,
  },
  {
    id: 'codm-qq9-diavolo',
    source: 'assets/collectee/items/codm-qq9-diavolo.png',
    sourceKind: 'dark-background',
    edgeColor: '#A42C18',
    maxDepth: 0.066,
  },
  {
    id: 'val-elderflame-dagger',
    source: 'assets/collectee/items/val-elderflame-dagger.png',
    sourceKind: 'dark-background',
    alphaMask: 'assets/collectee/depth/val-elderflame-dagger.png',
    edgeColor: '#C13B18',
    maxDepth: 0.042,
  },
  {
    id: 'val-elderflame-operator',
    source: 'assets/collectee/items/val-elderflame-operator.png',
    sourceKind: 'dark-background',
    edgeColor: '#A52C17',
    maxDepth: 0.052,
  },
  {
    id: 'val-elderflame-vandal',
    source:
      'assets/collectee/trellis-inputs/crown-jewels-weapons/val-elderflame-vandal.png',
    sourceKind: 'transparent',
    edgeColor: '#B62E17',
    maxDepth: 0.066,
  },
  {
    id: 'val-prime-karambit',
    source:
      'assets/collectee/trellis-inputs/crown-jewels-weapons/val-prime-karambit.png',
    sourceKind: 'transparent',
    edgeColor: '#D49B30',
    maxDepth: 0.04,
  },
  {
    id: 'val-prime-spectre',
    source: 'assets/collectee/items/val-prime-spectre.png',
    sourceKind: 'dark-background',
    edgeColor: '#C57D22',
    maxDepth: 0.064,
  },
  {
    id: 'val-prime-vandal',
    source: 'assets/collectee/items/val-prime-vandal.png',
    sourceKind: 'dark-background',
    edgeColor: '#C77E24',
    maxDepth: 0.06,
  },
  {
    id: 'val-singularity-knife',
    source: 'assets/collectee/items/val-singularity-knife.png',
    sourceKind: 'dark-background',
    edgeColor: '#6C35B8',
    maxDepth: 0.04,
  },
  {
    id: 'val-voidglass-blade',
    source: 'assets/collectee/items/val-voidglass-blade.png',
    sourceKind: 'dark-background',
    alphaMask: 'assets/collectee/depth/val-voidglass-blade.png',
    edgeColor: '#5A2AA6',
    maxDepth: 0.042,
  },
];

export const VERIFIED_WEAPON_INPUT_DIR =
  'assets/collectee/model-inputs/verified-weapons';

export function verifiedWeaponInput(id: string): string {
  return `${VERIFIED_WEAPON_INPUT_DIR}/${id}.png`;
}
