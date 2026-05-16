-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email        text NOT NULL,
  full_name    text,
  plan         text NOT NULL DEFAULT 'free',
  message_count integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Bots
CREATE TABLE bots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  tone         text NOT NULL DEFAULT 'friendly',
  status       text NOT NULL DEFAULT 'training',
  embed_token  text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bots" ON bots FOR ALL USING (auth.uid() = user_id);

-- Documents
CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id      uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  filename    text NOT NULL,
  file_url    text NOT NULL,
  file_type   text NOT NULL,
  status      text NOT NULL DEFAULT 'processing',
  chunk_count integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own documents" ON documents FOR ALL
  USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = documents.bot_id AND bots.user_id = auth.uid()));

-- Chunks (vectors)
CREATE TABLE chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id      uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     text NOT NULL,
  embedding   vector(1536),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own chunks" ON chunks FOR SELECT
  USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = chunks.bot_id AND bots.user_id = auth.uid()));

-- Vector index (add once you have >1000 rows)
-- CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Chat logs
CREATE TABLE chat_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id      uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  session_id  text NOT NULL,
  role        text NOT NULL,
  content     text NOT NULL,
  rating      smallint,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chat logs" ON chat_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM bots WHERE bots.id = chat_logs.bot_id AND bots.user_id = auth.uid()));
-- Public insert allowed (visitors chatting via embed/share link)
CREATE POLICY "Public can insert chat logs" ON chat_logs FOR INSERT WITH CHECK (true);
-- Public can update rating on their own message
CREATE POLICY "Public can rate messages" ON chat_logs FOR UPDATE USING (true) WITH CHECK (true);

-- Similarity search function
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  bot_id_filter   uuid,
  match_count     int DEFAULT 5,
  min_similarity  float DEFAULT 0.3
)
RETURNS TABLE (id uuid, content text, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM chunks c
  WHERE c.bot_id = bot_id_filter
    AND 1 - (c.embedding <=> query_embedding) > min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to increment message count on profile
CREATE OR REPLACE FUNCTION increment_message_count(profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET message_count = message_count + 1 WHERE id = profile_id;
END;
$$;

-- Auto-update updated_at on bots and documents
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bots_updated_at BEFORE UPDATE ON bots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
