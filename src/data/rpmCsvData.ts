export interface RawCell {
  room: string;
  eng: string;
  ac: string;
  housekeeping: string;
  inspection: string;
  isPublicHeader?: boolean;
}

export interface RawRow {
  block1: RawCell;
  block2: RawCell;
  block3: RawCell;
  block4: RawCell;
}

const emptyCell: RawCell = { room: '', eng: '', ac: '', housekeeping: '', inspection: '' };

export const RAW_CSV_ROWS: RawRow[] = [
  {
    block1: { room: 'Room 101', eng: '2026-05-15', ac: '2026-05-15', housekeeping: '', inspection: 'Done' },
    block2: { room: 'Room 201', eng: '2026-05-30', ac: '2026-05-30', housekeeping: '', inspection: '' },
    block3: { room: 'Room 301', eng: '2026-06-01', ac: '2026-06-01', housekeeping: '', inspection: '' },
    block4: { room: 'Room 401', eng: '2026-07-25', ac: '2026-07-25', housekeeping: '', inspection: 'Done' },
  },
  {
    block1: { room: 'Room 102', eng: '2026-05-19', ac: '2026-05-19', housekeeping: '', inspection: 'Done' },
    block2: { room: 'Room 202', eng: '2026-05-27', ac: '2026-05-27', housekeeping: '', inspection: '' },
    block3: { room: 'Room 302', eng: '2026-06-03', ac: '2026-06-03', housekeeping: '', inspection: '' },
    block4: { room: 'Room 402', eng: '2026-07-29', ac: '2026-07-29', housekeeping: '', inspection: 'Done' },
  },
  {
    block1: { room: 'Room 103', eng: '2026-05-05', ac: '2026-05-05', housekeeping: '', inspection: 'Done' },
    block2: { room: 'Room 203', eng: '2026-05-23', ac: '2026-05-23', housekeeping: '', inspection: '' },
    block3: { room: 'Room 303', eng: '2026-06-04', ac: '2026-06-04', housekeeping: '', inspection: '' },
    block4: { room: 'Room 403', eng: '2026-07-08', ac: '2026-07-08', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Room 105', eng: '2026-05-01', ac: '2026-05-01', housekeeping: '', inspection: 'Done' },
    block2: { room: 'Room 205', eng: '2026-06-27', ac: '2026-06-27', housekeeping: '', inspection: '' },
    block3: { room: 'Room 305', eng: '2026-06-05', ac: '2026-06-05', housekeeping: '', inspection: '' },
    block4: { room: 'Room 405', eng: '2026-07-30', ac: '2026-07-30', housekeeping: '', inspection: 'Done' },
  },
  {
    block1: { room: 'Room 106', eng: '2026-05-03', ac: '2026-05-03', housekeeping: '', inspection: '' },
    block2: { room: 'Room 206', eng: '2026-06-28', ac: '2026-06-28', housekeeping: '', inspection: '' },
    block3: { room: 'Room 306', eng: '2026-06-06', ac: '2026-06-06', housekeeping: '', inspection: '' },
    block4: { room: 'Room 406', eng: '2026-07-31', ac: '2026-07-31', housekeeping: '', inspection: 'Done' },
  },
  {
    block1: { room: 'Room 107', eng: '2026-07-12', ac: '2026-07-12', housekeeping: '', inspection: '' },
    block2: { room: 'Room 207', eng: '2026-06-29', ac: '2026-06-29', housekeeping: '', inspection: '' },
    block3: { room: 'Room 307', eng: '2026-06-07', ac: '2026-06-07', housekeeping: '', inspection: '' },
    block4: { room: 'Room 407', eng: '2026-08-07', ac: '2026-08-07', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Room 108', eng: '2026-07-10', ac: '2026-07-10', housekeeping: '', inspection: '' },
    block2: { room: 'Room 208', eng: '2026-06-30', ac: '2026-06-30', housekeeping: '', inspection: '' },
    block3: { room: 'Room 308', eng: '2026-06-09', ac: '2026-06-09', housekeeping: '', inspection: '' },
    block4: { room: 'Room 408', eng: '2026-08-08', ac: '2026-08-08', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Room 109', eng: '2026-05-10', ac: '2026-05-10', housekeeping: '', inspection: '' },
    block2: { room: 'Room 209', eng: '2026-05-29', ac: '2026-05-29', housekeeping: '', inspection: '' },
    block3: { room: 'Room 309', eng: '2026-06-20', ac: '2026-06-20', housekeeping: '', inspection: '' },
    block4: { room: 'Room 409', eng: '2026-08-09', ac: '2026-08-09', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Room 110', eng: '2026-05-11', ac: '2026-05-11', housekeeping: '', inspection: '' },
    block2: { room: 'Room 210', eng: '2026-06-01', ac: '2026-06-01', housekeeping: '', inspection: '' },
    block3: { room: 'Room 310', eng: '2026-06-10', ac: '2026-06-10', housekeeping: '', inspection: '' },
    block4: { room: 'Room 410', eng: '2026-08-10', ac: '2026-08-10', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Room 111', eng: '2026-05-13', ac: '2026-05-13', housekeeping: '', inspection: '' },
    block2: { room: 'Room 211', eng: '2026-05-11', ac: '2026-05-11', housekeeping: '', inspection: '' },
    block3: { room: 'Room 311', eng: '2026-06-11', ac: '2026-06-11', housekeeping: '', inspection: '' },
    block4: { room: 'Room 411', eng: '2026-05-11', ac: '2026-05-11', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Room 112', eng: '2026-05-16', ac: '2026-05-16', housekeeping: '', inspection: '' },
    block2: { room: 'Room 212', eng: '2026-06-02', ac: '2026-06-02', housekeeping: '', inspection: '' },
    block3: { room: 'Room 312', eng: '2026-05-06', ac: '2026-05-06', housekeeping: '', inspection: '' },
    block4: { room: 'Room 412', eng: '2026-08-11', ac: '2026-08-11', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Room 113', eng: '2026-07-23', ac: '2026-07-23', housekeeping: '', inspection: '' },
    block2: { room: 'Room 213', eng: '2026-06-03', ac: '2026-06-03', housekeeping: '', inspection: '' },
    block3: { room: 'Room 313', eng: '2026-05-08', ac: '2026-05-08', housekeeping: '', inspection: '' },
    block4: { room: 'Room 413', eng: '2026-06-10', ac: '2026-06-10', housekeeping: '', inspection: '' },
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 215', eng: '2026-07-05', ac: '2026-07-05', housekeeping: '', inspection: '' },
    block3: { room: 'Room 315', eng: '2026-06-14', ac: '2026-06-14', housekeeping: '', inspection: '' },
    block4: { room: 'Room 415', eng: '2026-05-10', ac: '2026-05-10', housekeeping: '', inspection: '' },
  },
  {
    block1: { isPublicHeader: true, room: 'Public Area', eng: '', ac: '', housekeeping: '', inspection: '' },
    block2: { room: 'Room 216', eng: '2026-06-28', ac: '2026-06-28', housekeeping: '', inspection: '' },
    block3: { room: 'Room 316', eng: '2026-06-11', ac: '2026-06-11', housekeeping: '', inspection: '' },
    block4: { room: 'Room 416', eng: '2026-08-12', ac: '2026-08-12', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Lobby', eng: '', ac: '', housekeeping: '', inspection: '' },
    block2: { room: 'Room 217', eng: '2026-06-04', ac: '2026-06-04', housekeeping: '', inspection: '' },
    block3: { room: 'Room 317', eng: '2026-06-12', ac: '2026-06-12', housekeeping: '', inspection: '' },
    block4: { room: 'Room 417', eng: '2026-08-13', ac: '2026-08-13', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Cultivate', eng: '', ac: '', housekeeping: '', inspection: '' },
    block2: { room: 'Room 218', eng: '2026-05-21', ac: '2026-05-21', housekeeping: '', inspection: '' },
    block3: { room: 'Room 318', eng: '2026-06-13', ac: '2026-06-13', housekeeping: '', inspection: '' },
    block4: { room: 'Room 418', eng: '2026-08-15', ac: '2026-08-15', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Shikar', eng: '', ac: 'Shikar Restaurant AC chemical washing(MTB5)', housekeeping: '', inspection: '' },
    block2: { room: 'Room 219', eng: '2026-07-02', ac: '2026-07-02', housekeeping: '', inspection: '' },
    block3: { room: 'Room 319', eng: '2026-06-15', ac: '2026-06-15', housekeeping: '', inspection: '' },
    block4: { room: 'Room 419', eng: '2026-08-01', ac: '2026-08-01', housekeeping: '', inspection: 'Done' },
  },
  {
    block1: { room: 'Polo & Isabel', eng: '', ac: '', housekeeping: '', inspection: '' },
    block2: { room: 'Room 220', eng: '2026-07-03', ac: '2026-07-03', housekeeping: '', inspection: '' },
    block3: { room: 'Room 320', eng: '2026-06-16', ac: '2026-06-16', housekeeping: '', inspection: 'Done' },
    block4: { room: 'Room 420', eng: '2026-08-16', ac: '2026-08-16', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Gym', eng: '', ac: '', housekeeping: '', inspection: '' },
    block2: { room: 'Room 221', eng: '2026-07-03', ac: '2026-07-03', housekeeping: '', inspection: '' },
    block3: { room: 'Room 321', eng: '2026-06-17', ac: '2026-06-17', housekeeping: '', inspection: '' },
    block4: { room: 'Room 421', eng: '2026-08-18', ac: '2026-08-18', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'Zen Room', eng: '', ac: '', housekeeping: '', inspection: '' },
    block2: { room: 'Room 223', eng: '2026-07-04', ac: '2026-07-04', housekeeping: '', inspection: '' },
    block3: { room: 'Room 322', eng: '2026-06-19', ac: '2026-06-19', housekeeping: '', inspection: '' },
    block4: { room: 'Room 422', eng: '2026-08-19', ac: '2026-08-19', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'L1 Corridor', eng: '', ac: '', housekeeping: '', inspection: '' },
    block2: { room: 'Room 225', eng: '2026-07-05', ac: '2026-07-05', housekeeping: '', inspection: '' },
    block3: { room: 'Room 323', eng: '2026-06-20', ac: '2026-06-20', housekeeping: '', inspection: '' },
    block4: { room: 'Room 423', eng: '2026-08-20', ac: '2026-08-20', housekeeping: '', inspection: 'Done' },
  },
  {
    block1: { room: 'L2 Corridor', eng: '', ac: '', housekeeping: '', inspection: '' },
    block2: { room: 'Room 226', eng: '2026-06-05', ac: '2026-06-05', housekeeping: '', inspection: '' },
    block3: { room: 'Room 325', eng: '2026-07-22', ac: '2026-07-22', housekeeping: '', inspection: '' },
    block4: { room: 'Room 425', eng: '2026-08-21', ac: '2026-08-21', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'L3 Corridor', eng: '', ac: '', housekeeping: '', inspection: '' },
    block2: { room: 'Room 227', eng: '2026-06-07', ac: '2026-06-07', housekeeping: '', inspection: '' },
    block3: { room: 'Room 326', eng: '2026-06-22', ac: '2026-06-22', housekeeping: '', inspection: '' },
    block4: { room: 'Room 426', eng: '2026-08-23', ac: '2026-08-23', housekeeping: '', inspection: '' },
  },
  {
    block1: { room: 'L4 Corridor', eng: '', ac: '', housekeeping: '', inspection: '' },
    block2: { room: 'Room 228', eng: '2026-07-10', ac: '2026-07-10', housekeeping: '', inspection: '' },
    block3: { room: 'Room 327', eng: '2026-06-23', ac: '2026-06-23', housekeeping: '', inspection: '' },
    block4: { room: 'Room 427', eng: '2026-08-25', ac: '2026-08-25', housekeeping: '', inspection: '' },
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 229', eng: '2026-07-07', ac: '2026-07-07', housekeeping: '', inspection: '' },
    block3: { room: 'Room 328', eng: '2026-06-24', ac: '2026-06-24', housekeeping: '', inspection: '' },
    block4: { room: 'Room 428', eng: '2026-07-06', ac: '2026-07-06', housekeeping: '', inspection: '' },
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 230', eng: '2026-07-13', ac: '2026-07-13', housekeeping: '', inspection: '' },
    block3: { room: 'Room 329', eng: '2026-06-25', ac: '2026-06-25', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 235', eng: '2026-07-14', ac: '2026-07-14', housekeeping: '', inspection: '' },
    block3: { room: 'Room 330', eng: '2026-06-26', ac: '2026-06-26', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 236', eng: '2026-07-15', ac: '2026-07-15', housekeeping: '', inspection: '' },
    block3: { room: 'Room 331', eng: '2026-06-26', ac: '2026-06-26', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 237', eng: '2026-07-16', ac: '2026-07-16', housekeeping: '', inspection: 'Done' },
    block3: { room: 'Room 332', eng: '2026-07-10', ac: '2026-07-10', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 238', eng: '2026-07-17', ac: '2026-07-17', housekeeping: '', inspection: 'Done' },
    block3: { room: 'Room 333', eng: '2026-07-11', ac: '2026-07-11', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 239', eng: '2026-07-11', ac: '2026-07-11', housekeeping: '', inspection: '' },
    block3: { room: 'Room 335', eng: '2026-06-29', ac: '2026-06-29', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 240', eng: '2026-06-09', ac: '2026-06-09', housekeeping: '', inspection: '' },
    block3: { room: 'Room 336', eng: '2026-06-30', ac: '2026-06-30', housekeeping: '', inspection: 'Done' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 241', eng: '2026-07-20', ac: '2026-07-20', housekeeping: '', inspection: 'Done' },
    block3: { room: 'Room 337', eng: '2026-07-01', ac: '2026-07-01', housekeeping: '', inspection: 'Done' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 242', eng: '2026-06-19', ac: '2026-06-19', housekeeping: '', inspection: '' },
    block3: { room: 'Room 338', eng: '2026-07-02', ac: '2026-07-02', housekeeping: '', inspection: 'Done' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 243', eng: '2026-07-18', ac: '2026-07-18', housekeeping: '', inspection: '' },
    block3: { room: 'Room 339', eng: '2026-07-03', ac: '2026-07-03', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 245', eng: '2026-06-21', ac: '2026-06-21', housekeeping: '', inspection: '' },
    block3: { room: 'Room 340', eng: '2026-07-04', ac: '2026-07-04', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 246', eng: '2026-06-22', ac: '2026-06-22', housekeeping: '', inspection: '' },
    block3: { room: 'Room 341', eng: '2026-07-06', ac: '2026-07-06', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 247', eng: '2026-06-23', ac: '2026-06-23', housekeeping: '', inspection: '' },
    block3: { room: 'Room 342', eng: '2026-07-25', ac: '2026-07-25', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 248', eng: '2026-06-24', ac: '2026-06-24', housekeeping: '', inspection: '' },
    block3: { room: 'Room 343', eng: '2026-07-08', ac: '2026-07-08', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 249', eng: '2026-06-25', ac: '2026-06-25', housekeeping: '', inspection: '' },
    block3: { room: 'Room 345', eng: '2026-07-09', ac: '2026-07-09', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 250', eng: '2026-05-25', ac: '2026-05-25', housekeeping: '', inspection: '' },
    block3: { room: 'Room 346', eng: '2026-07-10', ac: '2026-07-10', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 251', eng: '2026-06-27', ac: '2026-06-27', housekeeping: '', inspection: '' },
    block3: { room: 'Room 347', eng: '2026-07-11', ac: '2026-07-11', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: { room: 'Room 252', eng: '2026-06-28', ac: '2026-06-28', housekeeping: '', inspection: '' },
    block3: { room: 'Room 348', eng: '2026-07-19', ac: '2026-07-19', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: emptyCell,
    block3: { room: 'Room 349', eng: '2026-07-13', ac: '2026-07-13', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: emptyCell,
    block3: { room: 'Room 350', eng: '2026-07-13', ac: '2026-07-13', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: emptyCell,
    block3: { room: 'Room 351', eng: '2026-07-15', ac: '2026-07-15', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
  {
    block1: emptyCell,
    block2: emptyCell,
    block3: { room: 'Room 352', eng: '2026-07-17', ac: '2026-07-17', housekeeping: '', inspection: '' },
    block4: emptyCell,
  },
];
