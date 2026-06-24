export type SessionUserLike = {
  id?: string | null;
  name?: string | null;
};

export type SentryUser = {
  id?: string;
  username?: string;
};

export function toSentryUser(user?: SessionUserLike | null): SentryUser | null {
  if (!user) return null;

  const sentryUser: SentryUser = {};

  if (user.id) {
    sentryUser.id = String(user.id);
  }

  if (user.name) {
    sentryUser.username = user.name;
  }

  return Object.keys(sentryUser).length > 0 ? sentryUser : null;
}
