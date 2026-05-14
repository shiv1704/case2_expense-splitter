-- AddRecurringAndReceipt
-- Recurring fields on expenses
ALTER TABLE expenses ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE expenses ADD COLUMN recurrence_rule TEXT;
ALTER TABLE expenses ADD COLUMN recurrence_day INTEGER;
ALTER TABLE expenses ADD COLUMN next_due_date TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN parent_expense_id UUID;
ALTER TABLE expenses ADD COLUMN recurrence_anchor_id UUID;
ALTER TABLE expenses ADD COLUMN receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN receipt_filename TEXT;

CREATE INDEX expenses_next_due_date_idx ON expenses(next_due_date);

-- RecurringLog table
CREATE TABLE recurring_logs (
  id           UUID        NOT NULL DEFAULT gen_random_uuid(),
  expense_id   UUID        NOT NULL,
  anchor_id    UUID        NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date     TIMESTAMPTZ NOT NULL,
  status       TEXT        NOT NULL,
  CONSTRAINT recurring_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX recurring_logs_anchor_id_idx ON recurring_logs(anchor_id);
