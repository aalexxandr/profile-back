export enum CaseRole {
  FRONTEND_DEVELOPER = 'Frontend Developer',
  FULLSTACK_DEVELOPER = 'Fullstack Developer',
}

export interface Case {
  id: number;
  slug: string;
  name: string;
  projectLink: string;
  category: string;
  stack: string[];
  shortDescription: string;
  description: string;
  role: CaseRole;
  achievements: string[];
  createdAt: Date;
  updatedAt: Date;
}
