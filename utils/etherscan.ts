import axios from 'axios';

export async function getContractCode(address: string) {
  try {
    const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
    const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`;
    const res: any = await axios.get(url);
    return res.data.result[0];
  } catch (error) {
    console.error(error);
    return;
  }
}
