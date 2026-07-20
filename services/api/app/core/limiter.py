import time
import asyncio

class TokenBucketLimiter:
    def __init__(self, capacity: float, refill_rate: float):
        """
        capacity: Maximum tokens the bucket can hold.
        refill_rate: How many tokens are added to the bucket per second.
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.buckets = {}
        self.lock = asyncio.Lock()
        self.last_prune_time = time.time()

    def _prune_buckets(self, now: float):
        """
        Prunes buckets that have fully refilled back to full capacity.
        Since they are at max capacity, deleting them has no side effects,
        and they will be lazily recreated on the next request.
        """
        to_delete = []
        for ident, bucket in self.buckets.items():
            elapsed = now - bucket["last_updated"]
            refilled = elapsed * self.refill_rate
            current_tokens = min(self.capacity, bucket["tokens"] + refilled)
            if current_tokens >= self.capacity:
                to_delete.append(ident)
        for ident in to_delete:
            del self.buckets[ident]
        self.last_prune_time = now

    async def consume(self, identifier: str, tokens: int = 1) -> tuple[bool, float]:
        """
        Consumes tokens from the bucket for a given identifier.
        Returns:
            (is_allowed, retry_after)
            - is_allowed: True if the tokens were successfully consumed, False otherwise.
            - retry_after: Approximate seconds to wait before enough tokens are refilled.
        """
        now = time.time()
        async with self.lock:
            # Periodically prune fully refilled buckets to prevent memory leaks (every 5 minutes)
            if now - self.last_prune_time > 300:
                self._prune_buckets(now)

            if identifier not in self.buckets:
                self.buckets[identifier] = {
                    "tokens": self.capacity,
                    "last_updated": now
                }
            
            bucket = self.buckets[identifier]
            
            # Refill tokens based on time elapsed
            elapsed = now - bucket["last_updated"]
            refilled = elapsed * self.refill_rate
            bucket["tokens"] = min(self.capacity, bucket["tokens"] + refilled)
            bucket["last_updated"] = now
            
            if bucket["tokens"] >= tokens:
                bucket["tokens"] -= tokens
                if bucket["tokens"] >= self.capacity:
                    del self.buckets[identifier]
                return True, 0.0
            else:
                # Calculate how much time is needed to refill to get at least 1 token
                missing_tokens = tokens - bucket["tokens"]
                retry_after = missing_tokens / self.refill_rate
                return False, retry_after
