-- Jarvis (ANYA Neural OS) Supabase Migration Script
-- Run this in the Supabase SQL editor to set up the required tables

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table if not exists profiles (
  id uuid references auth.users(id) primary key,
  name text,
  role text default 'Commander',
  assistant_name text default 'Aanya',
  voice_enabled boolean default true,
  voice_provider text default 'browser',
  persona text default 'sharp',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Chats/Threads table
create table if not exists chats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Messages table
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid references chats(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  attachments jsonb, -- For storing file attachments metadata
  tool_calls jsonb, -- For storing executed tool calls
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User Settings table
create table if not exists user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) unique not null,
  settings jsonb, -- Store all settings as JSON
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User Notes table
create table if not exists user_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  title text,
  content text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User Tasks table
create table if not exists user_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  text text not null,
  priority text check (priority in ('low', 'normal', 'high')),
  done boolean default false,
  created timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable realtime replication for all tables
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table chats;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table user_settings;
alter publication supabase_realtime add table user_notes;
alter publication supabase_realtime add table user_tasks;

-- Set up Row Level Security (RLS) policies
-- Profiles: users can only see/update their own profile
alter table profiles enable row level security;
create policy "Users can view their own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);
create policy "Users can insert their own profile" on profiles
  for insert with check (auth.uid() = id);

-- Chats: users can only see/manage their own chats
alter table chats enable row level security;
create policy "Users can view their own chats" on chats
  for select using (auth.uid() = user_id);
create policy "Users can insert their own chats" on chats
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own chats" on chats
  for update using (auth.uid() = user_id);
create policy "Users can delete their own chats" on chats
  for delete using (auth.uid() = user_id);

-- Messages: users can only see/manage messages in their chats
alter table messages enable row level security;
create policy "Users can view their own messages" on messages
  for select using (auth.uid() = user_id);
create policy "Users can insert their own messages" on messages
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own messages" on messages
  for update using (auth.uid() = user_id);
create policy "Users can delete their own messages" on messages
  for delete using (auth.uid() = user_id);

-- User Settings: users can only see/update their own settings
alter table user_settings enable row level security;
create policy "Users can view their own settings" on user_settings
  for select using (auth.uid() = user_id);
create policy "Users can update their own settings" on user_settings
  for update using (auth.uid() = user_id);
create policy "Users can insert their own settings" on user_settings
  for insert with check (auth.uid() = user_id);

-- User Notes: users can only see/manage their own notes
alter table user_notes enable row level security;
create policy "Users can view their own notes" on user_notes
  for select using (auth.uid() = user_id);
create policy "Users can insert their own notes" on user_notes
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own notes" on user_notes
  for update using (auth.uid() = user_id);
create policy "Users can delete their own notes" on user_notes
  for delete using (auth.uid() = user_id);

-- User Tasks: users can only see/manage their own tasks
alter table user_tasks enable row level security;
create policy "Users can view their own tasks" on user_tasks
  for select using (auth.uid() = user_id);
create policy "Users can insert their own tasks" on user_tasks
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own tasks" on user_tasks
  for update using (auth.uid() = user_id);
create policy "Users can delete their own tasks" on user_tasks
  for delete using (auth.uid() = user_id);

-- Create indexes for better performance
create index if not exists idx_chats_user_id on chats(user_id);
create index if not exists idx_messages_chat_id on messages(chat_id);
create index if not exists idx_messages_user_id on messages(user_id);
create index if not exists idx_user_settings_user_id on user_settings(user_id);
create index if not exists idx_user_notes_user_id on user_notes(user_id);
create index if not exists idx_user_tasks_user_id on user_tasks(user_id);

-- Create trigger to automatically update updated_at column
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language 'plpgsql';

-- Apply triggers to tables that have updated_at column
drop trigger if exists update_profiles_updated_at on profiles;
create trigger update_profiles_updated_at
  before update on profiles
  for each row
  execute procedure update_updated_at_column();

drop trigger if exists update_chats_updated_at on chats;
create trigger update_chats_updated_at
  before update on chats
  for each row
  execute procedure update_updated_at_column();

drop trigger if exists update_user_settings_updated_at on user_settings;
create trigger update_user_settings_updated_at
  before update on user_settings
  for each row
  execute procedure update_updated_at_column();

drop trigger if exists update_user_notes_updated_at on user_notes;
create trigger update_user_notes_updated_at
  before update on user_notes
  for each row
  execute procedure update_updated_at_column();

drop trigger if exists update_user_tasks_updated_at on user_tasks;
create trigger update_user_tasks_updated_at
  before update on user_tasks
  for each row
  execute procedure update_updated_at_column();