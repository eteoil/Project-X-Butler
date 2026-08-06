/**
 * Case-insensitive substring match: does `text` contain any of `keywords`?
 * Returns the matched keyword, or null when nothing matches.
 */
export function matchKeyword(text, keywords = []) {
  if (!text) return null;
  const haystack = text.toLowerCase();
  for (const keyword of keywords) {
    if (!keyword) continue;
    if (haystack.includes(String(keyword).toLowerCase())) {
      return keyword;
    }
  }
  return null;
}

/**
 * Evaluates a single post against the repost/like rules from config and
 * returns which actions it qualifies for, along with the keyword that
 * triggered each one.
 *
 * @param {{ id: string, text: string }} post
 * @param {{ repost?: { enabled: boolean, keywords: string[] }, like?: { enabled: boolean, keywords: string[] } }} rules
 */
export function judgePost(post, rules = {}) {
  const decisions = {};

  if (rules.repost?.enabled) {
    const matched = matchKeyword(post.text, rules.repost.keywords);
    if (matched) decisions.repost = { matched };
  }

  if (rules.like?.enabled) {
    const matched = matchKeyword(post.text, rules.like.keywords);
    if (matched) decisions.like = { matched };
  }

  return decisions;
}

/**
 * Applies judgePost to a list of posts and returns only the ones with at
 * least one qualifying action, each annotated with its decisions.
 */
export function judgePosts(posts = [], rules = {}) {
  const results = [];
  for (const post of posts) {
    const decisions = judgePost(post, rules);
    if (Object.keys(decisions).length > 0) {
      results.push({ post, decisions });
    }
  }
  return results;
}
