-- Migration: Add oracle reviews and ratings system
-- Allows users to review and rate public oracles

-- Reviews table
CREATE TABLE IF NOT EXISTS oracle_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oracle_id UUID NOT NULL REFERENCES oracles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  review_text TEXT NOT NULL,

  -- Subcategory ratings (optional, 1-5 scale)
  data_quality_rating INTEGER CHECK (data_quality_rating >= 1 AND data_quality_rating <= 5),
  performance_rating INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  support_rating INTEGER CHECK (support_rating >= 1 AND support_rating <= 5),

  -- Verification
  verified_user BOOLEAN DEFAULT FALSE, -- Has made API calls to this oracle
  usage_count INTEGER DEFAULT 0, -- Number of API calls user has made

  -- Community interaction
  helpful_count INTEGER DEFAULT 0, -- Upvotes
  unhelpful_count INTEGER DEFAULT 0, -- Downvotes

  -- Creator response
  creator_response TEXT,
  creator_responded_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate reviews from same user
  UNIQUE(oracle_id, user_id)
);

-- Review helpfulness votes
CREATE TABLE IF NOT EXISTS review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES oracle_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('helpful', 'unhelpful')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One vote per user per review
  UNIQUE(review_id, user_id)
);

-- Oracle stats cache (for performance)
CREATE TABLE IF NOT EXISTS oracle_stats (
  oracle_id UUID PRIMARY KEY REFERENCES oracles(id) ON DELETE CASCADE,

  -- Review stats
  average_rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  rating_distribution JSONB DEFAULT '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}'::jsonb,

  -- Usage stats (from api_calls table)
  total_api_calls INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  calls_last_24h INTEGER DEFAULT 0,
  calls_last_7d INTEGER DEFAULT 0,
  calls_last_30d INTEGER DEFAULT 0,

  -- Performance stats
  avg_response_time_ms INTEGER DEFAULT 0,
  uptime_percentage DECIMAL(5, 2) DEFAULT 100.0,
  last_update_at TIMESTAMPTZ,

  -- Computed scores
  popularity_score INTEGER DEFAULT 0, -- Combined metric for sorting
  quality_score DECIMAL(5, 2) DEFAULT 0, -- Weighted score

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_oracle_reviews_oracle ON oracle_reviews(oracle_id);
CREATE INDEX IF NOT EXISTS idx_oracle_reviews_user ON oracle_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_reviews_rating ON oracle_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_oracle_reviews_created ON oracle_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_reviews_verified ON oracle_reviews(verified_user) WHERE verified_user = true;

CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user ON review_votes(user_id);

CREATE INDEX IF NOT EXISTS idx_oracle_stats_rating ON oracle_stats(average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_stats_popularity ON oracle_stats(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_stats_quality ON oracle_stats(quality_score DESC);

-- Add public visibility flag to oracles table
ALTER TABLE oracles
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS pricing_model TEXT CHECK (pricing_model IN ('free', 'pay_per_call', 'subscription', 'donation')),
ADD COLUMN IF NOT EXISTS price_per_call DECIMAL(20, 8), -- in USD or ETH
ADD COLUMN IF NOT EXISTS monthly_price DECIMAL(10, 2); -- for subscriptions

CREATE INDEX IF NOT EXISTS idx_oracles_public ON oracles(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_oracles_type_public ON oracles(oracle_type, is_public) WHERE is_public = true;

-- Function to update oracle stats after review
CREATE OR REPLACE FUNCTION update_oracle_stats_on_review()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert oracle stats
  INSERT INTO oracle_stats (oracle_id, average_rating, total_reviews, rating_distribution)
  SELECT
    NEW.oracle_id,
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*),
    jsonb_build_object(
      '1', COUNT(*) FILTER (WHERE rating = 1),
      '2', COUNT(*) FILTER (WHERE rating = 2),
      '3', COUNT(*) FILTER (WHERE rating = 3),
      '4', COUNT(*) FILTER (WHERE rating = 4),
      '5', COUNT(*) FILTER (WHERE rating = 5)
    )
  FROM oracle_reviews
  WHERE oracle_id = NEW.oracle_id
  ON CONFLICT (oracle_id) DO UPDATE SET
    average_rating = EXCLUDED.average_rating,
    total_reviews = EXCLUDED.total_reviews,
    rating_distribution = EXCLUDED.rating_distribution,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update stats
DROP TRIGGER IF EXISTS trigger_update_oracle_stats ON oracle_reviews;
CREATE TRIGGER trigger_update_oracle_stats
  AFTER INSERT OR UPDATE OR DELETE ON oracle_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_oracle_stats_on_review();

-- Function to update review vote counts
CREATE OR REPLACE FUNCTION update_review_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE oracle_reviews
    SET
      helpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = OLD.review_id AND vote_type = 'helpful'),
      unhelpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = OLD.review_id AND vote_type = 'unhelpful')
    WHERE id = OLD.review_id;
    RETURN OLD;
  ELSE
    UPDATE oracle_reviews
    SET
      helpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = NEW.review_id AND vote_type = 'helpful'),
      unhelpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = NEW.review_id AND vote_type = 'unhelpful')
    WHERE id = NEW.review_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update vote counts
DROP TRIGGER IF EXISTS trigger_update_review_votes ON review_votes;
CREATE TRIGGER trigger_update_review_votes
  AFTER INSERT OR UPDATE OR DELETE ON review_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_review_vote_counts();

-- RLS policies
ALTER TABLE oracle_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY "Anyone can read oracle reviews"
  ON oracle_reviews FOR SELECT
  USING (true);

-- Users can create reviews for public oracles
CREATE POLICY "Users can create reviews"
  ON oracle_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM oracles WHERE id = oracle_id AND is_public = true)
  );

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON oracle_reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- Oracle creators can add responses to reviews
CREATE POLICY "Creators can respond to reviews"
  ON oracle_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM oracles WHERE id = oracle_id AND user_id = auth.uid()
    )
  );

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON oracle_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Anyone can read review votes
CREATE POLICY "Anyone can read review votes"
  ON review_votes FOR SELECT
  USING (true);

-- Users can vote on reviews
CREATE POLICY "Users can vote on reviews"
  ON review_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their votes
CREATE POLICY "Users can update own votes"
  ON review_votes FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their votes
CREATE POLICY "Users can delete own votes"
  ON review_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Anyone can read oracle stats
CREATE POLICY "Anyone can read oracle stats"
  ON oracle_stats FOR SELECT
  USING (true);

-- Comments
COMMENT ON TABLE oracle_reviews IS 'User reviews and ratings for public oracles';
COMMENT ON TABLE review_votes IS 'Helpful/unhelpful votes on reviews';
COMMENT ON TABLE oracle_stats IS 'Cached statistics for oracle discovery and sorting';
COMMENT ON COLUMN oracle_reviews.verified_user IS 'User has made API calls to this oracle (verified reviewer)';
COMMENT ON COLUMN oracle_reviews.usage_count IS 'Number of API calls user has made to this oracle';
COMMENT ON COLUMN oracles.is_public IS 'Whether oracle appears in public marketplace';
COMMENT ON COLUMN oracles.pricing_model IS 'How users pay for this oracle (free, pay_per_call, subscription, donation)';
