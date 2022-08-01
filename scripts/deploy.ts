// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const acct1 = process.env.WL_ADDRESS_1 as string;
  const acct2 = process.env.WL_ADDRESS_2 as string;
  const treasuryAcct = process.env.TREASURY_ADDRESS as string;

  const spcERC20Address = "0x48E155918808A0F26B962402B7c2566F14DdE545";

  console.log("yyy1 accounts:", {
    jul: acct1,
    jun: acct2,
    tre: treasuryAcct,
  });
  console.log("-----------");
  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  console.log("yyy0 test 1");
  const liquidityPool = await LiquidityPool.deploy(spcERC20Address);
  console.log("yyy0 test 2");
  await liquidityPool.deployed();

  console.log("LP deployed to:", liquidityPool.address);

  // We get the contract to deploy
  console.log("yyy1 test 1");
  const Router = await ethers.getContractFactory("Router");
  console.log("yyy1 test 2");
  const router = await Router.deploy(liquidityPool.address, spcERC20Address);
  console.log("yyy1 test 3");
  // const Greeter = await ethers.getContractFactory("Greeter");
  // const greeter = await Greeter.deploy("Hello, Hardhat!");

  await router.deployed();

  console.log("ROUTER deployed to:", router.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
