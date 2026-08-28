export interface InternalPoll {
  id: string;
  conversation_id: string;
  created_by: string;
  question: string;
  options: string[];
  is_anonymous: boolean;
  is_multiple_choice: boolean;
  is_closed: boolean;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InternalPollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
}

export interface PollWithVotes extends InternalPoll {
  votes: InternalPollVote[];
  creator?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface PollOptionStats {
  optionIndex: number;
  optionText: string;
  voteCount: number;
  percentage: number;
  voters: string[];
}
