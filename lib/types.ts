export interface SellerData {
  name: string;
  team: string;
  lead: number;
  follow: number;
  booking: number;
  done: number;
  target: number;
  vacant: number;
  live: number;
  clip: number;
  clipTarget: number;
  liveInbox: number;
  liveLead: number;
  leadTypes: Record<string, number>;
}

export interface FollowCase {
  code: string;
  seller: string;
  dateIn: string;
  timeIn?: string;
  car: string;
  note: string;
  phone: string;
  channel: string;
  leadType: string;
  updateCount: number;
  lastUpdate: string;
  callProof: string;
  adminStatus: string;
  profile: string;
}

export interface BookingCase {
  seller: string;
  customer: string;
  car: string;
  plate: string;
  status: string;
  date: string;
  phone: string;
  price: number;
  deposit: number;
  finance: string;
  grade: string;
  year: string;
  signDate: string;
  resultDate: string;
  releaseDate: string;
  docsDate: string;
  leadCode: string;
  note: string;
  isCash: boolean;
}

export interface TeamData {
  lead: number;
  follow: number;
  vacant: number;
  booking: number;
  done: number;
  target: number;
  live: number;
  clip: number;
  clipTarget: number;
  members: string[];
}

export interface LiveSession {
  date: string;
  time: string;
  team: string;
  hosts: string[];
  topic: string;
  inbox: number;
  lead: number;
}

export interface LiveHostStats {
  sessions: number;
  inbox: number;
  lead: number;
  clip: number;
}

export interface LiveActivity {
  totalInbox: number;
  totalLead: number;
  totalSessions: number;
  byHost: Record<string, LiveHostStats>;
  sessions: LiveSession[];
}

export interface SummaryData {
  totalLeads: number;
  totalFollow: number;
  totalVacant: number;
  totalBookings: number;
  totalDone: number;
  totalTarget: number;
  leadRJ: number;
  leadNormal: number;
}

export interface TodaySummary {
  totalLeads: number;
  totalFollow: number;
  totalVacant: number;
  bySeller: Record<string, { lead: number; follow: number; vacant: number }>;
}

export interface MonthlySummary {
  totalLeads: number;
  leadNormal: number;
  leadRJ: number;
  totalFollow: number;
  totalVacant: number;
  totalDone: number;
  totalBookings: number;
  pipeline: Record<string, number>;
  sellers: Record<string, { lead: number; follow: number; vacant: number; done: number; booking: number }>;
  teams: Record<string, { lead: number; follow: number; vacant: number; done: number; booking: number }>;
}

export interface DashboardData {
  summary: SummaryData;
  today?: TodaySummary;
  pipeline: Record<string, number>;
  sellers: SellerData[];
  teams: Record<string, TeamData>;
  followCases: FollowCase[];
  bookingCases: BookingCase[];
  liveActivity: LiveActivity;
  monthlySummary?: Record<number, MonthlySummary>;
  userIdMap?: Record<string, string>;
  meta?: {
    generatedAt?: string;
    month?: number;
    year?: number;
    weeksElapsed?: number;
    clipMonthTarget?: number;
  };
}
