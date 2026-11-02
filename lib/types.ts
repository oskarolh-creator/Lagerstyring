export type Role = "admin" | "ansatt";

export type Profile = { id: string; full_name: string; role: Role };

export type Item = {
  id: string;
  name: string;
  category: string;
  description: string;
  total_qty: number;
  zone: string;
  rack: string;
  shelf: string;
  image_path: string | null;
  out_qty: number;
  available_qty: number;
};

export type Loan = {
  id: string;
  item_id: string;
  quantity: number;
  returned_qty: number;
  lent_by: string;
  borrower_name: string;
  borrower_company: string;
  borrower_phone: string;
  start_date: string;
  due_date: string;
  description: string;
  returned_at: string | null;
  created_at: string;
  items?: { name: string; image_path: string | null } | null;
  profiles?: { full_name: string } | null;
};

export const CATEGORIES = [
  "Stoler",
  "Bord",
  "Sofaer og lounge",
  "Barer",
  "Planter og trær",
  "Bannere og skilt",
  "Gjerder og avsperring",
  "Telt",
  "Lys og teknikk",
  "Dekor",
  "Annet",
];
