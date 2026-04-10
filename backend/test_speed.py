import time
import yfinance as yf

print("Testing yfinance speed...\n")

t = time.time()
tk = yf.Ticker('AAPL')
print(f"Ticker init:    {round(time.time()-t, 2)}s")

t = time.time()
h = tk.history(period='2d')
print(f"History fetch:  {round(time.time()-t, 2)}s")

t = time.time()
c = tk.options
print(f"Options list:   {round(time.time()-t, 2)}s")

t = time.time()
chain = tk.option_chain(c[0])
print(f"Options chain:  {round(time.time()-t, 2)}s")

print("\nDone! If any step is >10s, that's your bottleneck.")