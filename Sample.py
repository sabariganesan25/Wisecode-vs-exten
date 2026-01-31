"""
Sample Python file for testing Sentinel-Atomic
"""


def hello(name: str) -> str:
    """Say hello to someone."""
    greeting = f"Hello, {name}!"
    return greeting


def add_numbers(a: int, b: int) -> int:
    """Add two numbers together."""
    result = a + b
    return result


def calculate_fibonacci(n: int) -> list:
    """Calculate the first n Fibonacci numbers using recursion."""
    
    def fib(k: int) -> int:
        if k == 0:
            return 0
        if k == 1:
            return 1
        return fib(k - 1) + fib(k - 2)
    
    if n <= 0:
        return []
    
    return [fib(i) for i in range(n)]



class Calculator:
    """A simple calculator class."""
    
    def __init__(self, initial_value: float = 0):
        self.value = initial_value
    
    def add(self, x: float) -> float:
        """Add a value."""
        self.value += x
        return self.value
    
    def multiply(self, x: float) -> float:
        """Multiply by a value."""
        self.value *= x
        return self.value


def process_data(items: list) -> dict:
    """Process a list of items and return a summary."""
    summary = {
        "count": len(items),
        "unique": len(set(items)),
        "first": items[0] if items else None,
        "last": items[-1] if items else None
    }
    return summary
