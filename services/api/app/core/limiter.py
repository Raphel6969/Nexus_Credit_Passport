import time
from threading import Lock

class TokenBucketLimiter:
    def __init__(self, capacity: float, refill_rate: float):
        """
        capacity: Maximum tokens the bucket can hold.
        refill_rate: How many tokens are added to the bucket per second.
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.buckets = {}
        self.lock = Lock()

    def consume(self, identifier: str, tokens: int = 1) -> tuple[bool, float]:
        """
        Consumes tokens from the bucket for a given identifier.
        Returns:
            (is_allowed, retry_after)
            - is_allowed: True if the tokens were successfully consumed, False otherwise.
            - retry_after: Approximate seconds to wait before enough tokens are refilled.
        """
        now = time.time()
        with self.lock:
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
                return True, 0.0
            else:
                # Calculate how much time is needed to refill to get at least 1 token
                missing_tokens = tokens - bucket["tokens"]
                retry_after = missing_tokens / self.refill_rate
                return False, retry_after
