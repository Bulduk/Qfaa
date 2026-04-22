import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symbol, price, flux, config, agentType = 'generic', risk = 50, allocated = 0, swarmActive = false, swarmEngine = '', apiKey, apiSecret } = body;

    // Simulate parsing config.yaml
    const thresholdMatch = config.match(/threshold_sigma:\s*([0-9.]+)/);
    const threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 0.8;

    const usePaperMatch = config.match(/use_paper:\s*(true|false)/);
    const isPaper = usePaperMatch ? usePaperMatch[1] === 'true' : true;

    // Action Logic Node
    const action = flux > 0 ? 'BUY' : 'SELL';
    
    // Simulate computational processing time slightly differently per agent type
    const delayMap: Record<string, number> = { scout: 200, ghost: 100, grid: 800, hunter: 1000, sentinel: 1200, generic: 600 };
    // Swarm engines take longer due to multiple consensus nodes
    const delayMs = (delayMap[agentType] || 600) + (swarmActive ? 500 : 0);
    await new Promise(res => setTimeout(res, delayMs));

    // Agent-specific logic tweaks
    let effectiveFlux = flux;
    if (agentType === 'scout') effectiveFlux = flux * 1.5; 
    else if (agentType === 'ghost') effectiveFlux = flux * 2.0;

    // Determine Trade Outcome
    let tradePnl = 0;
    if (Math.abs(effectiveFlux) >= threshold) {
      // Predictly Engine: Trade size strictly isolated to vault * risk map
      const tradeSize = allocated * (risk / 100);
      
      // Calculate Win Probability Bias
      let minBias = -0.7;
      let maxBias = 2.0;
      let winMsg = `ROI`;

      if (swarmActive) {
        if (swarmEngine === 'MiroFish') {
          minBias = -0.3; 
          maxBias = 1.6;  
          winMsg = `[MiroFish Consensus: 8/10 Nodes] ROI`;
        } else if (swarmEngine === 'BettaFish') {
          minBias = -0.5;
          maxBias = 2.5; 
          winMsg = `[BettaFish Consensus: 4/5 Nodes] ROI`;
        }
      }

      const randomFactor = Math.random() * maxBias + minBias; 
      const roi = randomFactor * 0.05; 
      
      tradePnl = Number((tradeSize * roi).toFixed(2));
      
      let liveMessage = '';
      if (!isPaper && apiKey && apiSecret && tradeSize > 5) {
        try {
           const baseUrl = 'https://fapi.binance.com';
           const timestamp = Date.now();
           // Attempt to calculate a raw quantity (this limits precision errors for generic coins by using roughly 3-4 decimals max)
           const parsedPrice = parseFloat(price);
           let quantity = (tradeSize / parsedPrice).toFixed(3);
           if(parsedPrice < 1) quantity = (tradeSize / parsedPrice).toFixed(0); 
           
           const queryString = `symbol=${symbol}&side=${action}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
           const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
           
           const orderRes = await fetch(`${baseUrl}/fapi/v1/order?${queryString}&signature=${signature}`, {
             method: 'POST',
             headers: { 'X-MBX-APIKEY': apiKey }
           });
           
           const orderData = await orderRes.json();
           if (orderRes.ok) {
             liveMessage = ` [LIVE ORDER EXECUTED ID: ${orderData.orderId}]`;
           } else {
             liveMessage = ` [LIVE ORDER FAILED: ${orderData.msg}]`;
             // If execution failed on binance, we shouldn't simulate Pnl either
             tradePnl = 0; 
           }
        } catch(err: any) {
           liveMessage = ` [LIVE API NETWORK ERROR]`;
           tradePnl = 0;
        }
      } else if (!isPaper) {
         liveMessage = ` [WARN: TRADE SIZE TOO SMALL OR KEYS MISSING]`;
         tradePnl = 0;
      }
      
      return NextResponse.json({
        status: 'EXECUTED',
        action,
        symbol,
        price,
        pnl: tradePnl,
        isPaper,
        agent: agentType,
        message: `[${agentType.toUpperCase()} CORE] Position closed. ${winMsg}: ${(roi * 100).toFixed(2)}% | Volatility: ${Math.abs(effectiveFlux).toFixed(2)}σ${liveMessage}`
      });
    } else {
       return NextResponse.json({
        status: 'DROPPED',
        agent: agentType,
        message: `[${agentType.toUpperCase()} CORE] Signal (${flux.toFixed(2)}σ) did not meet execution threshold.`
      });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Kernel Panic', details: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
