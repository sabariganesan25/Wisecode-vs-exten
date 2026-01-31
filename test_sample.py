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
    """Calculate the first n Fibonacci numbers."""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]
    
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    
    return fib


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
