import { ethers } from "ethers";
import RouterJSON from "../../artifacts/contracts/Router.sol/Router.json";
import LpJSON from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import SpaceCoinTokenJSON from "../../../ico/artifacts/contracts/SpaceCoinToken.sol/SpaceCoinToken.json";
import { sign } from "crypto";

const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

const lpAddress = "0x5435f9b702a33eF6AF73803bda083dE117471e94";
const routerAddress = "0x772057Eb52bE4D69D589212aA4C2D59FbE275E95";
const spcAddress = "0x48E155918808A0F26B962402B7c2566F14DdE545";

const lpContract = new ethers.Contract(lpAddress, LpJSON.abi, provider);

const routerContract = new ethers.Contract(
  routerAddress,
  RouterJSON.abi,
  provider
);

const spcContract = new ethers.Contract(
  spcAddress,
  SpaceCoinTokenJSON.abi,
  provider
);

const pEther = (ethVal) => ethers.utils.parseEther(ethVal);

// const routerAddr = '0x422Db2b48c44c0A1Bf748f4bf304A8093b8F4eb6'
// const contract = new ethers.Contract(routerAddr, RouterJSON.abi, provider);

async function connectToMetamask() {
  try {
    console.log("Signed in as", await signer.getAddress());
  } catch (err) {
    console.log("Not signed in");
    await provider.send("eth_requestAccounts", []);
  }
}

ico_spc_approve.addEventListener("submit", async (e) => {
  e.preventDefault();
  await spcContract.connect(signer).approve(routerAddress, pEther("1000000")); // 1 million
});

ico_lp_approve.addEventListener("submit", async (e) => {
  e.preventDefault();
  await lpContract.connect(signer).approve(routerAddress, pEther("1000000")); // 1 million
});

//
// ICO
//
ico_spc_buy.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const eth = ethers.utils.parseEther(form.eth.value);
  console.log("Buying", eth, "eth");

  await connectToMetamask();
  // TODO: Call ico contract contribute function
});

//
// LP
//
let currentSpcToEthPrice = 5;

provider.on("block", async (n) => {
  console.log("New block", n);
  const reserveSPC = await lpContract.reserveSPC();
  const reserveETH = await lpContract.reserveETH();

  currentSpcToEthPrice = (await lpContract.reserveSPC()).div;
  // const spcAddressInRouter = await lpContract.spcAddress();
  const INIT = (await lpContract.INIT_TOKENS_TO_BURN()).toNumber();
  console.log("yyy2 test", {
    // reserveSPC,
    // reserveETH,
    test: reserveSPC.div(reserveETH).toNumber(),
    INIT,
    // spcAddressInRouter,
  });

  currentSpcToEthPrice = reserveSPC.div(reserveETH).toNumber();

  spc_pool.innerText = `${reserveSPC.toString()}  in SPC (10  ** 18) `;
  eth_pool.innerText = `${reserveETH.toString()} in ETH (10  ** 18)`;
  // TODO: Update currentSpcToEthPrice
});

lp_deposit.eth.addEventListener("input", (e) => {
  lp_deposit.spc.value = +e.target.value * currentSpcToEthPrice;
});

lp_deposit.spc.addEventListener("input", (e) => {
  lp_deposit.eth.value = +e.target.value / currentSpcToEthPrice;
});

lp_deposit.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const eth = ethers.utils.parseEther(form.eth.value);
  const spc = ethers.utils.parseEther(form.spc.value);
  console.log("Depositing", eth, "eth and", spc, "spc");

  await connectToMetamask();

  const to = await signer.getAddress();
  const desiredSpc = spc;
  const minSpc = spc;
  const maxSpc = spc;
  console.log("yyy2 to, desiredSpc, minSpc, maxSpc", {
    to,
    desiredSpc,
    minSpc,
    maxSpc,
  });
  // TODO: Call router contract deposit function
  await routerContract
    .connect(signer)
    .addLiquidity(to, desiredSpc, minSpc, maxSpc, { value: eth });
});

lp_withdraw.addEventListener("submit", async (e) => {
  e.preventDefault();
  console.log("Withdrawing 100% of LP");

  await connectToMetamask();
  // TODO: Call router contract withdraw function

  const _to = await signer.getAddress();
  const _minETH = 1;
  const _minSPC = 1;
  const _liquidity = 10 ** 7;
  await routerContract
    .connect(signer)
    .removeLiquidity(_to, _minETH, _minSPC, _liquidity);
});

//
// Swap
//
let swapIn = { type: "eth", value: 0 };
let swapOut = { type: "spc", value: 0 };
switcher.addEventListener("click", () => {
  [swapIn, swapOut] = [swapOut, swapIn];
  swap_in_label.innerText = swapIn.type.toUpperCase();
  swap.amount_in.value = swapIn.value;
  updateSwapOutLabel();
});

swap.amount_in.addEventListener("input", updateSwapOutLabel);

function updateSwapOutLabel() {
  swapOut.value =
    swapIn.type === "eth"
      ? +swap.amount_in.value * currentSpcToEthPrice
      : +swap.amount_in.value / currentSpcToEthPrice;

  swap_out_label.innerText = `${swapOut.value} ${swapOut.type.toUpperCase()}`;
}

swap.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const amountIn = ethers.utils.parseEther(form.amount_in.value);

  console.log("Swapping", amountIn, swapIn.type, "for", swapOut.type);

  await connectToMetamask();

  const to = await signer.getAddress();
  // TODO: Call router contract swap function

  if (swapIn.type === "eth") {
    console.log("holla");
    const eth = amountIn;

    const spcIn = 0;
    const minEthOut = 0;
    const minSpcOut = 1;
    console.log("yyy10", {
      to,
      spcIn,
      minEthOut,
      minSpcOut,
      eth,
    });
    await routerContract
      .connect(signer)
      .swap(to, spcIn, minEthOut, minSpcOut, { value: eth });
    // function swap(
    //   address _to,
    //   uint256 _spcIn,
    //   uint256 _ethMinOut,
    //   uint256 _spcMinOut
  } else {
    console.log("yoyo");
    const eth = 0;
    const spcIn = amountIn;
    const minEthOut = 1;
    const minSpcOut = 0;
    console.log("yyy10", {
      to,
      spcIn,
      minEthOut,
      minSpcOut,
      eth,
    });
    await routerContract
      .connect(signer)
      .swap(to, spcIn, minEthOut, minSpcOut, { value: eth });
  }
});
