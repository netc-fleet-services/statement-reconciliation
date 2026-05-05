/** Ordered map of parser key → display label. Mirrors VENDOR_LABELS in app.py. */
export const VENDORS: Record<string, string> = {
  advantage:     'Advantage Truck Group',
  arcsource:     'ArcSource Inc.',
  brookline:     'Brookline Machine / APW',
  castle:        'Castle Packs / Finger Lakes',
  cdk:           "CDK Global (Ballard, Lucky's, Grappone, Portsmouth Ford)",
  dennison:      'Dennison Lubricants',
  fleetpride:    'FleetPride',
  keystone:      'Keystone Automotive (LKQ)',
  kimball:       'Kimball Midwest',
  kljack:        'K.L. Jack & Co.',
  myers:         'Myers Tire Supply',
  nationaltire:  'National Tire Wholesale',
  nekw:          'New England Kenworth',
  omni:          'Omni Services',
  rctoolbox:     'RC Toolbox',
  stmt_unknown:  'Unknown Vendor (acct 63168)',
  sullivan:      'Sullivan Tire',
  unitedpacific: 'United Pacific Industries',
  whelen:        'Whelen Engineering',
  wisupply:      'WI Supply Boston',
  zips:          'Zips Truck Equipment (OCR / Scanned)',
};

export const VENDOR_KEYS = Object.keys(VENDORS);
