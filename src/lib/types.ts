export type Task = {
  id: string;
  title: string;
  owner: string | null;
  due: string | null;
  done: boolean;
  deadline_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type LinkItem = {
  id: string;
  label: string;
  url: string;
  category: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type Note = {
  id: string;
  body: string;
  author: string | null;
  created_at: string;
  parent_id: string | null; // non nul : réponse à une publication du mur
  tag: "impression" | "idee" | "question" | "decision" | null;
};

export type Session = {
  id: string;
  day: string;
  title: string;
  details: string | null;
  kind: "seance" | "rdv" | "autre";
  start_time: string | null; // « HH:MM:SS »
  end_time: string | null;
};

export type Deadline = {
  id: string;
  title: string;
  due: string;
  details: string | null;
};

export type Person = {
  id: string;
  name: string;
  category: string;
  role: string | null;
  email: string | null;
  linkedin: string | null;
  note: string | null;
  position: number;
};

export type Doc = {
  id: string;
  title: string;
  category: string;
  kind: "gdoc" | "note" | "link";
  url: string | null;
  body: string;
  summary: string | null;
  drive_file_id: string | null;
  drive_modified_time: string | null;
  drive_error: string | null;
  position: number;
  updated_by: string | null;
  updated_at: string;
};

export type DriveFolder = {
  id: string;
  label: string;
  last_synced_at: string | null;
};

export type DriveFile = {
  id: string;
  name: string;
  mime_type: string | null;
  parent_name: string | null;
  web_view_link: string | null;
  modified_time: string | null;
  last_modifying_user: string | null;
  trashed: boolean;
};

export type DriveEvent = {
  id: number;
  file_id: string;
  name: string;
  kind: "added" | "modified" | "removed";
  folder_label: string | null;
  parent_name: string | null;
  web_view_link: string | null;
  actor: string | null;
  happened_at: string | null;
  created_at: string;
};
