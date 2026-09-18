import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ProfileSummary } from '../types/profile.types.js';

interface ProfilesData {
  profiles: ProfileSummary[];
}

interface UsersData {
  users: Array<{ id: string; role: string; username: string }>;
}

function loadJson<T>(relativePath: string): T {
  const absolutePath = resolve(process.cwd(), relativePath);
  const raw = readFileSync(absolutePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export function getTestProfiles(): ProfileSummary[] {
  const data = loadJson<ProfilesData>('test-data/profiles.json');
  return data.profiles;
}

export function getTestProfileById(id: string): ProfileSummary {
  const profiles = getTestProfiles();
  const profile = profiles.find((p) => p.id === id);
  if (!profile) {
    throw new Error(`Test profile with id "${id}" not found in test-data/profiles.json`);
  }
  return profile;
}

export function getTestUsers(): UsersData['users'] {
  const data = loadJson<UsersData>('test-data/users.json');
  return data.users;
}
