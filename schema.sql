CREATE TABLE IF NOT EXISTS fh_profiles (
  user_id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fh_places (
  id text PRIMARY KEY,
  owner_id text REFERENCES fh_profiles(user_id),
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS fh_experiences (
  id text PRIMARY KEY,
  place_id text NOT NULL REFERENCES fh_places(id),
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS fh_points (
  id text PRIMARY KEY,
  place_id text NOT NULL REFERENCES fh_places(id),
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS fh_stays (
  user_id text PRIMARY KEY REFERENCES fh_profiles(user_id),
  place_id text NOT NULL REFERENCES fh_places(id),
  ends_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS fh_interests (
  user_id text REFERENCES fh_profiles(user_id),
  experience_id text REFERENCES fh_experiences(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, experience_id)
);
CREATE TABLE IF NOT EXISTS fh_saved (
  user_id text REFERENCES fh_profiles(user_id),
  experience_id text REFERENCES fh_experiences(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, experience_id)
);
CREATE TABLE IF NOT EXISTS fh_posts (
  id text PRIMARY KEY,
  author_id text NOT NULL REFERENCES fh_profiles(user_id),
  place_id text REFERENCES fh_places(id),
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS fh_post_interests (
  user_id text REFERENCES fh_profiles(user_id),
  post_id text REFERENCES fh_posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE IF NOT EXISTS fh_views (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id text NOT NULL REFERENCES fh_places(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fh_experiences_place ON fh_experiences(place_id);
CREATE INDEX IF NOT EXISTS fh_points_place ON fh_points(place_id);
CREATE INDEX IF NOT EXISTS fh_posts_place ON fh_posts(place_id);
CREATE INDEX IF NOT EXISTS fh_views_place ON fh_views(place_id);
