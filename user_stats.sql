
CREATE TABLE user_stats (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    heart_rate INT,
    steps INT,
    sleep_hours FLOAT,
    spo2 INT,
    weight FLOAT,
    bmi FLOAT,
    stress_level TEXT,
    mood TEXT,
    med_list JSONB,
    macros JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own stats" ON public.user_stats
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
