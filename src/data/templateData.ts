import type { Section } from '../types';
import templateJson from './inspection_template.json';

export const MAXWELL_SECTIONS: Section[] = templateJson.sections as Section[];

export const COMMON_ROOM_TYPES: string[] = templateJson.common_room_types;

export const COMMON_ROOMS: string[] = templateJson.common_rooms;

export const QUICK_DEFECT_TAGS: string[] = templateJson.quick_defect_tags;
