import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  LiquidityPool,
  LiquidityPool__factory,
  TestScToken,
  TestScToken__factory,
  Router,
  Router__factory,
} from "../typechain";

const errors = {
  ETH_TOO_HIGH_OR_SPC_TOO_LOW: "ETH_TOO_HIGH_OR_SPC_TOO_LOW",
  MIN_VALS_REQUIRED: "MIN_VALS_REQUIRED",
  SPC_TOO_HIGH_OR_ETH_TOO_LOW: "SPC_TOO_HIGH_OR_ETH_TOO_LOW",
  CAN_ONLY_SWAP_ONE_ASSET: "CAN_ONLY_SWAP_ONE_ASSET",
  NEED_ONE_ASSET_TO_SWAP: "NEED_ONE_ASSET_TO_SWAP",
  NEED_LIQUIDITY: "NEED_LIQUIDITY",
  INSUFFICIENT_LIQUIDITY: "INSUFFICIENT_LIQUIDITY",
  OUTPUT_LESS_THAN_MIN: "OUTPUT_LESS_THAN_MIN",
  SPC_MIN_OUT_REQUIRED: "SPC_MIN_OUT_REQUIRED",
  ETH_OR_SPC_PARAMS_REQURED: "ETH_OR_SPC_PARAMS_REQURED",
  MIN_REQUIREMENTS_NOT_MET: "MIN_REQUIREMENTS_NOT_MET",
  FIRST_LP_NEEDS_FUNDS: "FIRST_LP_NEEDS_FUNDS",
  EXPECTED_SPC_LESS_THAN_MIN: "EXPECTED_SPC_LESS_THAN_MIN",
  EXPECTED_SPC_MORE_THAN_MAX: "EXPECTED_SPC_MORE_THAN_MAX",
  MIN_MUST_BE_SMALLER: "MIN_MUST_BE_SMALLER",
  MAX_MUST_BE_GREATER: "MAX_MUST_BE_GREATER",
  MUST_ADD_TO_LP: "MUST_ADD_TO_LP",
  MUST_BE_GREATER_THAN_0: "MUST_BE_GREATER_THAN_0",
  MUST_HAVE_MINS: "MUST_HAVE_MINS",
};

const pEther = (ethVal: string) => ethers.utils.parseEther(ethVal);

const ONE_ETH: BigNumber = ethers.utils.parseEther("1");
const FIVE_ETH: BigNumber = ethers.utils.parseEther("5");
const TEN_ETH: BigNumber = ethers.utils.parseEther("10");
const ELEVEN_ETH: BigNumber = ethers.utils.parseEther("11");
const TWENTY_ETH: BigNumber = ethers.utils.parseEther("20");
const FORTY_ETH: BigNumber = ethers.utils.parseEther("40");
const FIFTY_ETH: BigNumber = ethers.utils.parseEther("50");
const FIFTY_ONE_ETH: BigNumber = ethers.utils.parseEther("51");
const HUNDRED_ETH: BigNumber = ethers.utils.parseEther("100");
const FIVE_HUNDRED_ETH: BigNumber = ethers.utils.parseEther("500");
const ONE_K_ETH: BigNumber = ethers.utils.parseEther("1000");
const TWO_K_ETH: BigNumber = ethers.utils.parseEther("2000");
const FIVE_K_ETH: BigNumber = ethers.utils.parseEther("5000");
const TEN_K_ETH: BigNumber = ethers.utils.parseEther("10000");

const SECONDS_IN_DAY: number = 60 * 60 * 24;
const timeTravel = async (seconds: number) => {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
};

describe("LP Project", async () => {
  let lpAddress: string;
  let routerAddress: string;
  let spcAddress: string;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let ashley: SignerWithAddress;
  let dom: SignerWithAddress;
  let treasuryAddr: SignerWithAddress;

  let LiquidityPoolFactory: LiquidityPool__factory;
  let liquidityPool: LiquidityPool;

  let RouterFactory: Router__factory;
  let router: Router;

  let TestScTokenFactory: TestScToken__factory;
  let testScTokenToken: TestScToken;

  const deploySoloERC20 = async () => {
    TestScTokenFactory = await ethers.getContractFactory("TestScToken");
    testScTokenToken = (await TestScTokenFactory.deploy(
      deployer.address,
      treasuryAddr.address
    )) as TestScToken;
    await testScTokenToken.deployed();
    spcAddress = testScTokenToken.address;
  };

  const deployLP = async () => {
    LiquidityPoolFactory = await ethers.getContractFactory("LiquidityPool");
    liquidityPool = (await LiquidityPoolFactory.deploy(
      testScTokenToken.address
    )) as LiquidityPool;
    await liquidityPool.deployed();
    lpAddress = liquidityPool.address;
  };

  const deployRouter = async () => {
    RouterFactory = await ethers.getContractFactory("Router");
    router = (await RouterFactory.deploy(lpAddress, spcAddress)) as Router;
    await router.deployed();
    routerAddress = router.address;
  };

  beforeEach(async () => {
    // set signers
    [deployer, alice, bob, ashley, treasuryAddr, dom] =
      await ethers.getSigners();

    // deploy SPC Test Token
    await deploySoloERC20();

    // set LP
    await deployLP();

    // deploy router so we can test it
    await deployRouter();

    // GIVE bob & alice 10k SPCs to mess around with
    await testScTokenToken.safeMint(bob.address, TEN_K_ETH);
    await testScTokenToken.safeMint(alice.address, TEN_K_ETH);

    // APPROVE router to move bob / alice SPC tokens
    await testScTokenToken.connect(bob).approve(routerAddress, FIVE_K_ETH);
    await testScTokenToken.connect(alice).approve(routerAddress, FIVE_K_ETH);

    // APPROVE router to move bob LP tokens
    await liquidityPool.connect(bob).approve(routerAddress, FIVE_K_ETH);
    await liquidityPool.connect(alice).approve(routerAddress, FIVE_K_ETH);
  });

  const createLpBalanced = async () => {
    // this create a ratio of 1 eth / 1 spc
    // immitate transfer which would have happened in the router addLiquidity func
    await testScTokenToken.connect(bob).transfer(lpAddress, ONE_K_ETH);

    await liquidityPool.connect(bob).mint(bob.address, { value: ONE_K_ETH });
  };

  const createLiquidity1ethto5spc = async () => {
    // this create a ratio of 10 eth / 50 spc
    const spc = FIFTY_ETH;
    const eth = TEN_ETH;
    /// immitate transfer which would have happened in the router addLiquidity func
    await testScTokenToken.connect(bob).transfer(lpAddress, spc);

    await liquidityPool.connect(bob).mint(bob.address, {
      value: eth,
    });
  };

  const createLiquidity1spcto5eth = async () => {
    // this create a ratio of 50 eth / 10 spc
    const spc = TEN_ETH;
    const eth = FIFTY_ETH;
    // immitate transfer which would have happened in the router addLiquidity func
    await testScTokenToken.connect(bob).transfer(lpAddress, spc);

    await liquidityPool.connect(bob).mint(bob.address, {
      value: eth,
    });
  };

  describe("Liquidity Pool", async () => {
    describe("Mint func", async () => {
      it("Liquidity Pool presets should be correct", async function () {
        expect(await liquidityPool.reserveETH()).to.eq(0);
        expect(await liquidityPool.INIT_TOKENS_TO_BURN()).to.eq(10 ** 3);
      });

      it("correctly 1st despot 1k eth and 1k SPC correctly", async () => {
        await createLpBalanced();

        expect(await liquidityPool.reserveETH()).to.eq(ONE_K_ETH);
        expect(await liquidityPool.reserveSPC()).to.eq(ONE_K_ETH);
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(ONE_K_ETH);
        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999"
        );
      });
      it("correctly 1st despot 10 eth and 50 SPC correctly", async () => {
        // immitate transfer which would have happened in the router add liquidity func
        const spc = FIFTY_ETH;
        const eth = TEN_ETH;
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);
        await liquidityPool.connect(bob).mint(bob.address, { value: eth }); //sending eth

        expect(await liquidityPool.reserveETH()).to.eq(TEN_ETH);
        expect(await liquidityPool.reserveSPC()).to.eq(FIFTY_ETH);
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(FIFTY_ETH);
        const lpBobBalance = "22360679774997896964"; // around 22.36 lp tokens
        const lpTokenAmount = "22360679774997897964"; // similar but of by the INIT_TOKENS_TO_BURN
        expect(await liquidityPool.totalSupply()).to.eq(lpTokenAmount);
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(lpBobBalance);
      });

      it("trying to mint with 0 eth - fail", async () => {
        // immitate transfer which would have happened in the router add liquidity func
        const spc = 0;
        const eth = 0;
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);
        await expect(
          liquidityPool.connect(bob).mint(bob.address, { value: eth })
        ).to.be.revertedWith(errors.MUST_ADD_TO_LP);
      });

      it("when pool is 1 to 1, add SPC correctly, 0 LP tokens should be issued", async () => {
        await createLpBalanced();

        // tokens after first liquidity event
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999"
        );

        // lp total amount after first LP event
        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );

        // immitate transfer which would have happened in the router add liquidity func
        const spc = ONE_K_ETH;
        const eth = 0;
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        // 2nd liquidity event. ONLY send eth
        await liquidityPool.connect(bob).mint(bob.address, { value: eth });
        expect(await liquidityPool.reserveETH()).to.eq(ONE_K_ETH);
        expect(await liquidityPool.reserveSPC()).to.eq(TWO_K_ETH);

        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(TWO_K_ETH);

        // tokens after second liquidity event haven't changed because bob sent only SPC
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999"
        );

        // lp total amount after second LP event. this is correct. since alice didn't provided a terrible ratio
        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );
      });

      it("when pool is 1 to 1, add ETH correctly, 0 LP tokens should be issued", async () => {
        await createLpBalanced();

        // lp total amount after first LP event
        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );

        // immitate transfer which would have happened in the router add liquidity func
        const spc = 0;
        const eth = ONE_K_ETH;
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        // 2nd liquidity event. ONLY send eth
        await liquidityPool.connect(bob).mint(alice.address, { value: eth });
        expect(await liquidityPool.reserveETH()).to.eq(TWO_K_ETH);

        expect(await liquidityPool.balanceOf(alice.address)).to.eq(0);
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(ONE_K_ETH);

        // lp total amount after second LP event. this is correct. since alice didn't provided a terrible ratio
        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );
      });

      it("when pool is 1 to 1, add 1k ETH & SPC correctly, 1k more LP tokens should be issued", async () => {
        await createLpBalanced();

        // lp total amount after first LP event
        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );

        // immitate transfer which would have happened in the router add liquidity func
        const spc = ONE_K_ETH;
        const eth = ONE_K_ETH;
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        // 2nd liquidity event. ONLY send eth
        await liquidityPool.connect(bob).mint(alice.address, { value: eth });
        expect(await liquidityPool.reserveETH()).to.eq(TWO_K_ETH);

        expect(await liquidityPool.balanceOf(alice.address)).to.eq(
          "1000000000000000000999"
        );
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(TWO_K_ETH);

        // lp total amount after second LP event
        expect(await liquidityPool.totalSupply()).to.eq(
          "2000000000000000001998"
        );
      });

      it("when pool is 1 to 1, add 1k ETH &  500 SPC correctly, 500 more LP tokens should be issued", async () => {
        await createLpBalanced();

        // immitate transfer which would have happened in the router add liquidity func
        const spc = FIVE_HUNDRED_ETH;
        const eth = ONE_K_ETH;
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        // 2nd liquidity event. ONLY send eth
        await liquidityPool.connect(bob).mint(alice.address, {
          value: eth,
        });
        expect(await liquidityPool.reserveETH()).to.eq(TWO_K_ETH);

        expect(await liquidityPool.balanceOf(alice.address)).to.eq(
          "500000000000000000499"
        );
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(
          ethers.utils.parseEther("1500")
        ); // 1.5K

        // lp total amount after second LP event
        expect(await liquidityPool.totalSupply()).to.eq(
          "1500000000000000001498"
        ); // 1.5 k lp tokens in circulation
      });

      it("correctly 1st despot 1k eth and 500 SPC", async () => {
        const spc = ONE_K_ETH;
        const eth = FIVE_HUNDRED_ETH;
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        await liquidityPool.connect(bob).mint(bob.address, { value: eth });

        expect(await liquidityPool.reserveETH()).to.eq(FIVE_HUNDRED_ETH);
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          FIVE_HUNDRED_ETH
        );
        expect(await liquidityPool.reserveSPC()).to.eq(ONE_K_ETH);
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(ONE_K_ETH);
        expect(await liquidityPool.totalSupply()).to.eq(
          "707106781186547525400" // ~ 707 ~ = (500* 1000)**(1/2)
        );
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "707106781186547524400" // ~ 707 ~ = (500* 1000)**(1/2)
        );
      });
      it("correctly 1st despot 500 eth and 1k SPC", async () => {
        const spc = FIVE_HUNDRED_ETH;
        const eth = ONE_K_ETH;
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        await liquidityPool.connect(bob).mint(bob.address, { value: eth });

        expect(await liquidityPool.reserveETH()).to.eq(ONE_K_ETH);
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          ONE_K_ETH
        );
        expect(await liquidityPool.reserveSPC()).to.eq(FIVE_HUNDRED_ETH);
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(
          FIVE_HUNDRED_ETH
        );
        expect(await liquidityPool.totalSupply()).to.eq(
          "707106781186547525400" // ~ 707 ~ = (500* 1000)**(1/2)
        );
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "707106781186547524400" // ~ 707 ~ = (500* 1000)**(1/2)
        );
      });

      it("first lp mint has no eth should fail", async () => {
        const spc = FIVE_HUNDRED_ETH;
        const eth = 0;
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        await expect(
          liquidityPool.connect(bob).mint(bob.address, { value: eth })
        ).to.be.revertedWith(errors.FIRST_LP_NEEDS_FUNDS);
      });
      it("first lp mint has no spc should fail", async () => {
        const spc = 0;
        const eth = FIVE_HUNDRED_ETH;
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        await expect(
          liquidityPool.connect(bob).mint(bob.address, { value: eth })
        ).to.be.revertedWith(errors.FIRST_LP_NEEDS_FUNDS);
      });
    });

    describe("Burn func", async () => {
      it("burn 10LP tokens", async () => {
        await createLpBalanced();
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999" // ~ almost 1k
        );

        // immitate removeLiquidity
        await liquidityPool
          .connect(bob)
          .transfer(liquidityPool.address, TEN_ETH);

        expect(await liquidityPool.balanceOf(liquidityPool.address)).to.eq(
          TEN_ETH
        );

        await liquidityPool.connect(bob).burn(ashley.address);

        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "989999999999999999999" // ~ almost 990
        );

        expect(await liquidityPool.balanceOf(ashley.address)).to.eq(0);
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(
          "9999999999999999990"
        ); // ~ almost 10
        expect(await ashley.getBalance()).to.eq("10000009999999999999999990"); // original balance + almost ~ 10
      });
      it("burn 100LP tokens", async () => {
        await createLpBalanced();
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999" // ~ almost 1k
        );

        // immitate removeLiquidity
        await liquidityPool
          .connect(bob)
          .transfer(liquidityPool.address, HUNDRED_ETH);

        expect(await liquidityPool.balanceOf(liquidityPool.address)).to.eq(
          HUNDRED_ETH
        );

        await liquidityPool.connect(bob).burn(ashley.address);

        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "899999999999999999999" // ~ almost 900
        );

        expect(await liquidityPool.balanceOf(ashley.address)).to.eq(0);
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(
          "99999999999999999900"
        ); // ~ almost 100
        expect(await ashley.getBalance()).to.eq("10000109999999999999999890"); // original balance + almost ~ 100

        expect(await liquidityPool.reserveETH()).to.eq("900000000000000000100"); // ~ 900 eth
        expect(await liquidityPool.reserveSPC()).to.eq("900000000000000000100"); // ~ 900 spc
      });
      it("burn max tokens", async () => {
        await createLpBalanced();
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999" // ~ almost 1k
        );

        // immitate removeLiquidity
        await liquidityPool
          .connect(bob)
          .transfer(liquidityPool.address, "999999999999999999999");

        expect(await liquidityPool.balanceOf(liquidityPool.address)).to.eq(
          "999999999999999999999"
        );

        await liquidityPool.connect(bob).burn(ashley.address);

        expect(await liquidityPool.balanceOf(bob.address)).to.eq(0);

        expect(await liquidityPool.balanceOf(ashley.address)).to.eq(0);
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(
          "999999999999999999000"
        ); // ~ almost 1k
        expect(await ashley.getBalance()).to.eq("10001109999999999999998890"); // original balance + almost ~ 1k

        expect(await liquidityPool.reserveETH()).to.eq("1000"); // ~ lp pool almost empty but has some remains as expected
        expect(await liquidityPool.reserveSPC()).to.eq("1000"); // ~ lp pool almost empty but has some remains as expected
      });
      it("burn with multiple addresses added to liquidity", async () => {
        await createLpBalanced();

        // immitate removeLiquidity
        await liquidityPool
          .connect(bob)
          .transfer(liquidityPool.address, HUNDRED_ETH);

        expect(await liquidityPool.balanceOf(liquidityPool.address)).to.eq(
          HUNDRED_ETH
        );

        await liquidityPool.connect(bob).burn(alice.address);

        // second person minting and burning

        // immitate router sending SPC to lp
        await testScTokenToken.connect(alice).transfer(lpAddress, ONE_K_ETH);
        await liquidityPool
          .connect(alice)
          .mint(alice.address, { value: ONE_ETH });

        // immitate removeLiquidity
        await liquidityPool
          .connect(alice)
          .transfer(liquidityPool.address, ONE_ETH);

        await liquidityPool.connect(alice).burn(ashley.address);
      });

      it("try to execute burn without sendind LP tokens", async () => {
        await expect(
          liquidityPool.connect(bob).burn(ashley.address)
        ).to.be.revertedWith(errors.MUST_BE_GREATER_THAN_0);
      });
    });
    describe("swap func", async () => {
      it("lp is 10eth, 50spc, swap 1 ETHER (keep in mind 1% fee)", async () => {
        // add liquidity
        await createLiquidity1ethto5spc();

        expect(await liquidityPool.totalSupply()).to.eq("22360679774997897964");

        const to = ashley.address;
        const spc = 0;
        const eth = ONE_ETH;

        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        await liquidityPool.swap(to, { value: eth });

        // check the reserves of both spc and k
        // check how many tokens were sent to _to

        expect(await liquidityPool.reserveETH()).to.eq(ELEVEN_ETH);
        expect(await liquidityPool.reserveSPC()).to.eq("45495905368516833484"); // ~ 4.504 less than before min fee
        // actual balance should match reserve eth
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          ELEVEN_ETH
        );

        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(
          "4504094631483166516" // ~  4.504 tokens added to ashley
        );
      });

      it("lp is 50eth, 10spc, swap 1 SPC (keep in mind 1% fee)", async () => {
        await createLiquidity1spcto5eth();

        const to = ashley.address;
        const spc = ONE_ETH;
        const eth = 0;
        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        await liquidityPool.swap(to, { value: eth });

        expect(await liquidityPool.reserveSPC()).to.eq(ELEVEN_ETH);
        expect(await liquidityPool.reserveETH()).to.eq("45495905368516833484"); // ~ 4.46 less than before
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          "45495905368516833484"
        );

        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(0);

        // // commenting out because ashley's balance doesn't reset after every test so this is flaky
        // expect(await ashley.getBalance()).to.eq("10001114504094631483165406"); // ~ 4.504 more than before
      });

      it("try to swap spc when someone sent spc directly to try to mess with contract", async () => {
        await createLiquidity1spcto5eth(); // 10 spc / 50 eth in reserves + actual

        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(TEN_ETH);

        const spc = ONE_ETH;

        // knucklehead sends 40 spc to try to mess with contract
        await testScTokenToken.connect(alice).transfer(lpAddress, FORTY_ETH);

        // this should make LP ratio 1 to 1. 50 in each
        expect(await liquidityPool.reserveSPC()).to.eq(TEN_ETH);
        expect(await liquidityPool.reserveETH()).to.eq(FIFTY_ETH);
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          FIFTY_ETH
        );

        //  10 spc / 50 eth SPC in reserves
        // 50 spc in actuality
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(FIFTY_ETH);

        const to = dom.address;
        const spcIn = ONE_ETH;
        const ethMinOut = 1;

        // bob sends one spc to swap. but in fact will swap 41 because of ashely
        await router.connect(bob).swap(to, spcIn, ethMinOut, 0, { value: 0 });

        expect(await liquidityPool.reserveSPC()).to.eq(pEther("51")); // 51 spc this is correct
        expect(await liquidityPool.reserveETH()).to.eq("9883376161296698952"); // ETH left is around 10. since 40 eth was transferred to dom
        expect(await dom.getBalance()).to.eq("10000040116623838703301048"); // dom has ~40 additional eth
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          "9883376161296698952" // balance is correct
        );
      });

      it("when swap must provide at least one asset", async () => {
        await createLiquidity1spcto5eth();

        const to = ashley.address;
        const spc = 0;
        const eth = 0;
        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);
        // we need at least one asset to swap
        await expect(liquidityPool.swap(to, { value: eth })).to.be.revertedWith(
          errors.NEED_ONE_ASSET_TO_SWAP
        );
      });
      it("when you try to swap ETH and there is no liquidity yet, should stop", async () => {
        // we didn't add liquidity so trying to swap shouldn't work
        const to = ashley.address;
        const spc = ONE_ETH;
        const eth = 0;
        // we need at least one asset to swap
        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        await expect(liquidityPool.swap(to, { value: eth })).to.be.revertedWith(
          errors.NEED_LIQUIDITY
        );
      });

      it("when you try to swap SPC and there is no liquidity yet, should stop", async () => {
        // we didn't add liquidity so trying to swap shouldn't work
        const to = ashley.address;
        const spc = 0;
        const eth = ONE_ETH;

        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);
        await expect(liquidityPool.swap(to, { value: eth })).to.be.revertedWith(
          errors.NEED_LIQUIDITY
        );
      });
      it("lp is 10eth, 50spc and user tries to swap 10 ETH ", async () => {
        // add liquidity
        await createLiquidity1ethto5spc();

        const to = ashley.address;
        const spc = 0;
        const eth = ethers.utils.parseEther("10");

        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);
        await liquidityPool.swap(to, { value: eth });

        expect(await liquidityPool.reserveETH()).to.eq(TWENTY_ETH);
        expect(await liquidityPool.reserveSPC()).to.eq("25125628140703517587"); // ~ should be around half of what it was before
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          TWENTY_ETH
        );
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(
          "24874371859296482413" // ~ ash should get around half of available spc tokens
        );
      });

      it("lp is 10eth, 50spc and user tries to swap 11 ETH ", async () => {
        // add liquidity
        await createLiquidity1ethto5spc();

        const to = ashley.address;
        const spc = 0;
        const eth = ethers.utils.parseEther("11");
        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);
        await expect(liquidityPool.swap(to, { value: eth })).to.be.revertedWith(
          errors.INSUFFICIENT_LIQUIDITY
        );
      });

      it("lp is 10eth, 50spc and user tries to swap 50 SPC ", async () => {
        // add liquidity
        await createLiquidity1ethto5spc();

        const to = ashley.address;
        const spc = FIFTY_ETH;
        const eth = 0;
        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);
        await liquidityPool.swap(to, { value: eth });

        expect(await liquidityPool.reserveETH()).to.eq("5025125628140703517"); // ~ should be around half of what it was before minus fee
        expect(await liquidityPool.reserveSPC()).to.eq(HUNDRED_ETH); // 50 + 50 = 100
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(0);

        // actual balance should match reserve eth
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          "5025125628140703517"
        );
      });

      it("lp is 10eth, 50spc and user tries to swap 51 SPC ", async () => {
        // add liquidity
        await createLiquidity1ethto5spc();

        const to = ashley.address;
        const spc = FIFTY_ONE_ETH;
        const eth = 0;
        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        await liquidityPool.swap(to, { value: eth });

        expect(await liquidityPool.reserveETH()).to.eq("4975619464623345606"); // ~ 5 eth should be around half of what it was before minus fee
        expect(await liquidityPool.reserveSPC()).to.eq(pEther("101")); // 50 + 51 = 101
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(0);

        // actual balance should match reserve eth
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          "4975619464623345606"
        );
      });

      it("lp is 10eth, 50spc and user tries to swap 1 SPC ", async () => {
        // add liquidity
        await createLiquidity1ethto5spc();

        const to = ashley.address;
        const spc = ONE_ETH;
        const eth = 0;

        expect(await liquidityPool.reserveETH()).to.eq(TEN_ETH); // ~ should be around half of what it was before

        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        await liquidityPool.swap(to, { value: eth });

        expect(await liquidityPool.reserveETH()).to.eq("9805844283192782898"); // ~ 10 - (.2 * .99) that was sent to ashley
        expect(await liquidityPool.reserveSPC()).to.eq("51000000000000000000"); // 50  + 1
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(0);

        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          "9805844283192782898"
        );
      });

      it("lp is 10eth, 50spc and user tries to swap 0.001 SPC", async () => {
        // add liquidity
        await createLiquidity1ethto5spc();

        const to = ashley.address;
        const spc = ethers.utils.parseEther("0.001");
        const eth = 0;

        expect(await liquidityPool.reserveETH()).to.eq(TEN_ETH); // ~ should be around half of what it was before

        // immiate transfer which would have happened in the router swap func
        await testScTokenToken.connect(bob).transfer(lpAddress, spc);

        await liquidityPool.swap(to, { value: eth });

        expect(await liquidityPool.reserveETH()).to.eq("9999802003920322377"); // ~ 10 - (.0002 * .99) that was sent to ashley
        expect(await liquidityPool.reserveSPC()).to.eq("50001000000000000000"); // 50  + .001

        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          "9999802003920322377"
        );
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(0);
      });
    });
  });

  describe("Router", async () => {
    const addRouterEvenLpRatio2 = async () => {
      const minSPC = ONE_K_ETH;
      const maxSPC = ONE_K_ETH;
      const actualETH = ONE_K_ETH;
      const desiredSpc = ONE_K_ETH;
      await router
        .connect(bob)
        .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
          value: actualETH,
        });
    };

    const addRouter1to5LpRatio2 = async () => {
      const minSPC = FIFTY_ETH;
      const maxSPC = FIFTY_ETH;
      const actualETH = TEN_ETH; // 10
      const desiredSpc = FIFTY_ETH;
      await router
        .connect(bob)
        .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
          value: actualETH,
        });
    };

    describe("Add Liquidity", async () => {
      it("add liquidity v2 - first 1K ETH, 1K SPC deposit works", async () => {
        await addRouterEvenLpRatio2();

        expect(await liquidityPool.reserveETH()).to.eq(ONE_K_ETH);
        expect(await liquidityPool.reserveSPC()).to.eq(ONE_K_ETH);
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(ONE_K_ETH);
        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999"
        );
      });

      it("add liquidity v2 - first 1K ETH, 1K SPC deposit works with mins set to 0", async () => {
        const minSPC = 0;
        const maxSPC = 0;
        const actualETH = ONE_K_ETH;
        const desiredSpc = ONE_K_ETH;
        await router
          .connect(bob)
          .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
            value: actualETH,
          });
        expect(await liquidityPool.reserveETH()).to.eq(ONE_K_ETH);
        expect(await liquidityPool.reserveSPC()).to.eq(ONE_K_ETH);
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(ONE_K_ETH);
        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999"
        );
      });

      it("add liquidity v2. ratio is even. 2nd event, add 1eth, 1spc, minSpc=0.9, maxSpc=1.1 - should pass", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        // ratio is 1/1 so this should pass
        const actualETH = ONE_ETH;
        const minSPC = pEther("0.9");
        const maxSPC = pEther("1.1");
        const desiredSpc = pEther("1");
        await router
          .connect(bob)
          .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
            value: actualETH,
          });

        expect(await liquidityPool.reserveETH()).to.eq(pEther("1001"));
        expect(await liquidityPool.reserveSPC()).to.eq(pEther("1001"));
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(
          pEther("1001")
        );
        expect(await liquidityPool.totalSupply()).to.eq(
          "1001000000000000000999" // 1k + ~ 1
        );
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "1000999999999999999999" // ~ 1k + ~ 1
        );
      });

      it("add liquidity v2. ratio is even. 2nd event, add 1eth, 1.2spc, minSpc=1.1, maxSpc=1.3 - should fail", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        // ratio is 1/1 so this should fail
        const actualETH = ONE_ETH;
        const minSPC = pEther("1.1");
        const desiredSpc = pEther("1.2");
        const maxSPC = pEther("1.3");

        await expect(
          router
            .connect(bob)
            .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
              value: actualETH,
            })
        ).to.be.revertedWith(errors.EXPECTED_SPC_LESS_THAN_MIN);
      });

      it("add liquidity v2. ratio is even. 2nd event, add 1eth, 0.9spc, minSpc=0.8, maxSpc=0.95 - should fail", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        // ratio is 1/1 so this should fail
        const actualETH = ONE_ETH;
        const minSPC = pEther("0.8");
        const desiredSpc = pEther("0.9");
        const maxSPC = pEther("0.95");

        await expect(
          router
            .connect(bob)
            .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
              value: actualETH,
            })
        ).to.be.revertedWith(errors.EXPECTED_SPC_MORE_THAN_MAX);
      });

      it("add liquidity v2. ratio is even. 2nd event, add 1eth, 0.9spc, minSpc=0.8, maxSpc=1 - should pass", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        // ratio is 1/1 so this should pass
        const actualETH = ONE_ETH;
        const minSPC = pEther("0.8");
        const desiredSpc = pEther("0.9");
        const maxSPC = pEther("1");

        await router
          .connect(bob)
          .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
            value: actualETH,
          });

        expect(await liquidityPool.reserveETH()).to.eq(pEther("1001"));
        expect(await liquidityPool.reserveSPC()).to.eq(pEther("1001"));
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(
          pEther("1001")
        );
        expect(await liquidityPool.totalSupply()).to.eq(
          "1001000000000000000999" // 1k + ~ 1
        );
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "1000999999999999999999" // ~ 1k + ~ 1
        );
      });

      it("add liquidity v2. ratio is even. 2nd event, add 1eth, 1.2spc, minSpc=1, maxSpc=1.2 - should pass", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        // ratio is 1/1 so this should pass
        const actualETH = ONE_ETH;
        const minSPC = pEther("1");
        const desiredSpc = pEther("1.1");
        const maxSPC = pEther("1.2");

        await router
          .connect(bob)
          .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
            value: actualETH,
          });

        expect(await liquidityPool.reserveETH()).to.eq(pEther("1001"));
        expect(await liquidityPool.reserveSPC()).to.eq(pEther("1001"));
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(
          pEther("1001")
        );
        expect(await liquidityPool.totalSupply()).to.eq(
          "1001000000000000000999" // 1k + ~ 1
        );
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "1000999999999999999999" // ~ 1k + ~ 1
        );
      });

      it("add liquidity v2. ratio is 1/5. 2nd event, add 1eth, 5spc, minSpc=4.5, maxSpc=5.5 - should pass", async () => {
        // first LP event
        await addRouter1to5LpRatio2();

        // ratio is 10 eth / 50 spc
        const actualETH = ONE_ETH;
        const minSPC = pEther("4");
        const desiredSpc = pEther("5");
        const maxSPC = pEther("5.5");

        await router
          .connect(bob)
          .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
            value: actualETH,
          });

        expect(await liquidityPool.reserveETH()).to.eq(pEther("11")); // 10 + 1
        expect(await liquidityPool.reserveSPC()).to.eq(pEther("55")); // 50 + 5
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(pEther("55"));
        expect(await liquidityPool.totalSupply()).to.eq("24596747752497687760");
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "24596747752497686760"
        );
      });

      it("add liquidity v2. ratio is 1/5. 2nd event, add 1eth, 5.2spc, minSpc=5.1, maxSpc=5.2 - should fail", async () => {
        // first LP event
        await addRouter1to5LpRatio2();

        // ratio is 10 eth / 50 spc
        const actualETH = ONE_ETH;
        const minSPC = pEther("5.1");
        const desiredSpc = pEther("5.2");
        const maxSPC = pEther("5.3");

        await expect(
          router
            .connect(bob)
            .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
              value: actualETH,
            })
        ).to.be.revertedWith(errors.EXPECTED_SPC_LESS_THAN_MIN);
      });

      it("add liquidity v2. desired is smaller than min - fail", async () => {
        // first LP event
        await addRouter1to5LpRatio2();

        // ratio is 10 eth / 50 spc
        const actualETH = ONE_ETH;
        const minSPC = pEther("5.1");
        const desiredSpc = pEther("0.2");
        const maxSPC = pEther("5.3");

        await expect(
          router
            .connect(bob)
            .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
              value: actualETH,
            })
        ).to.be.revertedWith(errors.MIN_MUST_BE_SMALLER);
      });

      it("add liquidity v2. desired is greater than max - fail", async () => {
        // first LP event
        await addRouter1to5LpRatio2();

        // ratio is 10 eth / 50 spc
        const actualETH = ONE_ETH;
        const minSPC = pEther("5.1");
        const desiredSpc = pEther("10.2");
        const maxSPC = pEther("5.3");

        await expect(
          router
            .connect(bob)
            .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
              value: actualETH,
            })
        ).to.be.revertedWith(errors.MAX_MUST_BE_GREATER);
      });

      it("try sending eth 0 on 2nd event -fail", async () => {
        await addRouter1to5LpRatio2();

        // ratio is 10 eth / 50 spc
        const actualETH = 0;
        const minSPC = pEther("5.1");
        const desiredSpc = pEther("5.2");
        const maxSPC = pEther("5.3");

        await expect(
          router
            .connect(bob)
            .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
              value: actualETH,
            })
        ).to.be.revertedWith(errors.MIN_VALS_REQUIRED);
      });

      it("try sending spc 0 on 2nd event -fail", async () => {
        await addRouter1to5LpRatio2();

        // ratio is 10 eth / 50 spc
        const actualETH = ONE_ETH;
        const minSPC = 0;
        const desiredSpc = 0;
        const maxSPC = pEther("5.3");

        await expect(
          router
            .connect(bob)
            .addLiquidity(bob.address, desiredSpc, minSPC, maxSPC, {
              value: actualETH,
            })
        ).to.be.revertedWith(errors.MIN_VALS_REQUIRED);
      });
    });
    describe("Swap in router", () => {
      it("try to swap w/ no liquidity", async () => {
        const to = ashley.address;
        const spcIn = 0;
        const ethMinOut = 0;
        const ethIn = ONE_ETH;
        const spcMinOut = ethers.utils.parseEther("0.95");
        await expect(
          router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
            value: ethIn,
          })
        ).to.be.revertedWith(errors.INSUFFICIENT_LIQUIDITY);
      });

      it("a lp ratio of 1 to 1 is created. try to swap both eth and spc", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        const to = ashley.address;
        const spcIn = ONE_ETH;
        const ethMinOut = 0;
        const ethIn = ONE_ETH;
        const spcMinOut = 0;
        await expect(
          router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
            value: ethIn,
          })
        ).to.be.revertedWith(errors.CAN_ONLY_SWAP_ONE_ASSET);
      });

      it("a lp ratio of 1 to 1 is created. incorrect ETH vars part 1", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        const to = ashley.address;
        const spcIn = 0;
        const ethMinOut = 0;
        const ethIn = ONE_ETH;
        const spcMinOut = 0;
        await expect(
          router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
            value: ethIn,
          })
        ).to.be.revertedWith(errors.SPC_MIN_OUT_REQUIRED);
      });

      it("a lp ratio of 1 to 1 is created. incorrect ETH vars part 2", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        const to = ashley.address;
        const spcIn = 0;
        const ethMinOut = 0;
        const ethIn = 0;
        const spcMinOut = ethers.utils.parseEther("0.95");
        await expect(
          router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
            value: ethIn,
          })
        ).to.be.revertedWith(errors.ETH_OR_SPC_PARAMS_REQURED);
      });

      it("a lp ratio of 1 to 1 is created. incorrect ETH vars part 2", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        const to = ashley.address;
        const spcIn = ONE_ETH;
        const ethMinOut = ethers.utils.parseEther("2.95");
        const ethIn = 0;
        const spcMinOut = 0;
        await expect(
          router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
            value: ethIn,
          })
        ).to.be.revertedWith(errors.OUTPUT_LESS_THAN_MIN);
      });

      it("a lp ratio of 1 to 1 is created. spc min out .99 - reject", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        const to = ashley.address;
        const spcIn = 0;
        const ethMinOut = 0;
        const ethIn = ONE_ETH;
        const spcMinOut = ethers.utils.parseEther("0.99");
        await expect(
          router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
            value: ethIn,
          })
        ).to.be.revertedWith(errors.OUTPUT_LESS_THAN_MIN);
      });

      it("a lp ratio of 1 to 1 is created. 1spc, eth min out .95 - accept", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        const to = ashley.address;
        const spcIn = ONE_ETH;
        const ethMinOut = ethers.utils.parseEther("0.95");
        const ethIn = 0;
        const spcMinOut = 0;

        await router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
          value: ethIn,
        });

        expect(await liquidityPool.reserveETH()).to.eq("999010979130660645960"); // 1k - ~1eth
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          "999010979130660645960"
        );
        expect(await liquidityPool.reserveSPC()).to.eq(
          ethers.utils.parseEther("1001")
        ); // 1k + 1 spc
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(0);
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(
          ethers.utils.parseEther("1001") // 1k + 1 spc token
        );

        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );
      });

      it("a lp ratio of 1 to 1 is created. 1spc, eth min out 1.95 - reject", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        const to = ashley.address;
        const spcIn = ONE_ETH;
        const ethMinOut = ethers.utils.parseEther("1.95");
        const ethIn = 0;
        const spcMinOut = 0;

        await expect(
          router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
            value: ethIn,
          })
        ).to.be.revertedWith(errors.OUTPUT_LESS_THAN_MIN);
      });

      it("a lp ratio of 1 to 5 is created. 1spc, eth min out .15 - accept", async () => {
        // 10 eth, 50 spc

        // first LP event
        await createLiquidity1ethto5spc();

        const to = ashley.address;
        const spcIn = ONE_ETH;
        const ethMinOut = ethers.utils.parseEther("0.15");
        const ethIn = 0;
        const spcMinOut = 0;
        await testScTokenToken.connect(bob).approve(routerAddress, FIVE_K_ETH);
        await router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
          value: ethIn,
        });
        // 9805844283192782898
        expect(await liquidityPool.reserveETH()).to.eq("9805844283192782898"); // 10 eth - ~.2eth
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          "9805844283192782898"
        );
        expect(await liquidityPool.reserveSPC()).to.eq(
          ethers.utils.parseEther("51") // 50 spc + 1 spc
        );
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(0);
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(
          ethers.utils.parseEther("51") // 50 + 1 spc token
        );

        expect(await liquidityPool.totalSupply()).to.eq("22360679774997897964");
      });

      it("a lp ratio of 1 to 1 is created. 1spc, eth min out .95 - accept", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        const to = ashley.address;
        const spcIn = ONE_ETH;
        const ethMinOut = ethers.utils.parseEther("0.95");
        const ethIn = 0;
        const spcMinOut = 0;
        await testScTokenToken.connect(bob).approve(routerAddress, FIVE_K_ETH);
        await router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
          value: ethIn,
        });

        expect(await liquidityPool.reserveETH()).to.eq("999010979130660645960"); // 1k - ~1eth
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          "999010979130660645960"
        );
        expect(await liquidityPool.reserveSPC()).to.eq(
          ethers.utils.parseEther("1001")
        ); // 1k + 1 spc
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(0);
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(
          ethers.utils.parseEther("1001") // 1k + 1 spc token
        );

        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );
      });

      it("a lp ratio of 1 to 1 is created. spc min out .95 - accept", async () => {
        // first LP event
        await addRouterEvenLpRatio2();

        const to = ashley.address;
        const spcIn = 0;
        const ethMinOut = 0;
        const ethIn = ONE_ETH;
        const spcMinOut = ethers.utils.parseEther("0.95");
        await router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
          value: ethIn,
        });
        expect(await liquidityPool.reserveETH()).to.eq(
          ethers.utils.parseEther("1001")
        ); // 1k + 1 new eth
        expect(await liquidityPool.reserveSPC()).to.eq("999010979130660645960"); // ~ 1k - 1 spc
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(
          "989020869339354040"
        );
        expect(await testScTokenToken.balanceOf(lpAddress)).to.eq(
          "999010979130660645960"
        );

        expect(await liquidityPool.totalSupply()).to.eq(
          "1000000000000000000999"
        );
      });

      it("a lp ratio of 1 to 5 is created. 1spc, eth min out .95 - accept", async () => {
        // first LP event
        await createLiquidity1spcto5eth();

        const to = ashley.address;
        const spcIn = ONE_ETH;
        const ethMinOut = ethers.utils.parseEther("0.95");
        const ethIn = 0;
        const spcMinOut = 0;
        await router.connect(bob).swap(to, spcIn, ethMinOut, spcMinOut, {
          value: ethIn,
        });

        expect(await liquidityPool.reserveSPC()).to.eq(ELEVEN_ETH);
        expect(await liquidityPool.reserveETH()).to.eq("45495905368516833484"); // ~ 4.504 less than before
        expect(await ethers.provider.getBalance(liquidityPool.address)).to.eq(
          "45495905368516833484"
        );

        // flaky test because ashley balance is not reset
        // expect(await ashley.getBalance()).to.eq("10001114504094631483165406"); // ~ 4.504 more than before
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(0);
      });
    });
    describe("Remove Liquidity", () => {
      it("with 1k/1k eth/spc removeLiquidity 10 tokens", async () => {
        // the result of this should be that ashley gets almost 10 eth and 10 spc back
        await createLpBalanced();
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999" // ~ almost 1k lp tokens that bob has
        );

        const to = ashley.address;
        const minEth = ethers.utils.parseEther("9.5");
        const minSpc = ethers.utils.parseEther("9.5");
        const lpTokensToBurn = TEN_ETH;

        await router
          .connect(bob)
          .removeLiquidity(to, minEth, minSpc, lpTokensToBurn);

        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "989999999999999999999" // ~ almost 990
        );

        expect(await liquidityPool.balanceOf(ashley.address)).to.eq(0);
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(
          "9999999999999999990"
        ); // ~ almost 10

        // flaky because ashley's balance doesn't reset after every test so commenting out for now
        // expect(await ethers.provider.getBalance(ashley.address)).to.eq(
        //   "10000009999999999999999990"
        // ); // prev amount + ~ 10
      });

      it("with 1k/1k eth/spc removeLiquidity - must have mins error", async () => {
        // the result of this should be that ashley gets almost 10 eth and 10 spc back
        await createLpBalanced();
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999" // ~ almost 1k lp tokens that bob has
        );

        const to = ashley.address;
        const minEth = 0;
        const minSpc = 0;
        const lpTokensToBurn = TEN_ETH;

        await expect(
          router
            .connect(bob)
            .removeLiquidity(to, minEth, minSpc, lpTokensToBurn)
        ).to.be.revertedWith(errors.MUST_HAVE_MINS);
      });

      it("with 1k/1k eth/spc removeLiquidity 10 tokens. minEth = 10. should fail", async () => {
        // since in the result, ashley will get slightly less than 10. so code should return an error
        await createLpBalanced();
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999" // ~ almost 1k lp tokens that bob has
        );

        const to = ashley.address;
        const minEth = TEN_ETH;
        const minSpc = ONE_ETH;
        const lpTokensToBurn = TEN_ETH;

        await expect(
          router
            .connect(bob)
            .removeLiquidity(to, minEth, minSpc, lpTokensToBurn)
        ).to.be.revertedWith(errors.MIN_REQUIREMENTS_NOT_MET);
      });

      it("with 1k/1k eth/spc removeLiquidity 10 tokens. minSpc = 10. should fail", async () => {
        // since in the result, ashley will get slightly less than 10. so code should return an error
        await createLpBalanced();
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999" // ~ almost 1k lp tokens that bob has
        );

        const to = ashley.address;
        const minEth = ONE_ETH;
        const minSpc = TEN_ETH;
        const lpTokensToBurn = TEN_ETH;

        await expect(
          router
            .connect(bob)
            .removeLiquidity(to, minEth, minSpc, lpTokensToBurn)
        ).to.be.revertedWith(errors.MIN_REQUIREMENTS_NOT_MET);
      });
      it("with 1k/1k eth/spc removeLiquidity 999 tokens", async () => {
        // the result of this should be that ashley gets almost 10 eth and 10 spc back
        await createLpBalanced();
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999999" // ~ almost 1k lp tokens that bob has
        );

        const to = ashley.address;
        const minEth = ONE_ETH;
        const minSpc = ONE_ETH;
        const lpTokensToBurn = ethers.utils.parseEther("999");

        await router
          .connect(bob)
          .removeLiquidity(to, minEth, minSpc, lpTokensToBurn);

        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "999999999999999999" // ~ less than 1 (almost 1k - 999 removeLiquditiy)
        );

        expect(await liquidityPool.balanceOf(ashley.address)).to.eq(0);
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(
          "998999999999999999001"
        ); // ~ almost 999

        // // flaky because ashley's balance doesn't reset after every test so commenting out for now
        // expect(await ethers.provider.getBalance(ashley.address)).to.eq(
        //   "10001008999999999999998991"
        // ); // prev amount + ~ 999
      });
      it("with 10eth/50th eth/spc removeLiquidity 10 tokens", async () => {
        // 10 eth / 50 spc
        await createLiquidity1ethto5spc();
        const lpBobBalance = "22360679774997896964"; // around 22.36 lp tokens
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(lpBobBalance);

        const to = ashley.address;
        const minEth = ethers.utils.parseEther("1.5");
        const minSpc = ethers.utils.parseEther("1.5");
        const lpTokensToBurn = TEN_ETH;

        await router
          .connect(bob)
          .removeLiquidity(to, minEth, minSpc, lpTokensToBurn);

        expect(await liquidityPool.balanceOf(bob.address)).to.eq(
          "12360679774997896964"
        ); // ~12.36 = 22.36 - 10 tokens that are burned

        expect(await liquidityPool.balanceOf(ashley.address)).to.eq(0);
        expect(await testScTokenToken.balanceOf(ashley.address)).to.eq(
          "22360679774997895964"
        ); // ~ 22.3 a bit less than half the tokens in the spc pool (originally 50).
        // this logically makes sense since we tried to burn 10 of 23 available spc tokens ~ little less than half
      });

      it("with 10eth/50th eth/spc removeLiquidity 10 tokens. minEth=5 should fail", async () => {
        // 10 eth / 50 spc
        await createLiquidity1ethto5spc();
        const lpBobBalance = "22360679774997896964"; // around 22.36 lp tokens
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(lpBobBalance);

        const to = ashley.address;
        const minEth = FIVE_ETH;
        const minSpc = ethers.utils.parseEther("1.5");
        const lpTokensToBurn = TEN_ETH;

        await expect(
          router
            .connect(bob)
            .removeLiquidity(to, minEth, minSpc, lpTokensToBurn)
        ).to.be.revertedWith(errors.MIN_REQUIREMENTS_NOT_MET);
      });

      it("with 10eth/50th eth/spc removeLiquidity 10 tokens. minSpc=23 should fail", async () => {
        // 10 eth / 50 spc
        await createLiquidity1ethto5spc();
        const lpBobBalance = "22360679774997896964"; // around 22.36 lp tokens
        expect(await liquidityPool.balanceOf(bob.address)).to.eq(lpBobBalance);

        const to = ashley.address;
        const minEth = ONE_ETH;
        const minSpc = ethers.utils.parseEther("23");
        const lpTokensToBurn = TEN_ETH;

        await expect(
          router
            .connect(bob)
            .removeLiquidity(to, minEth, minSpc, lpTokensToBurn)
        ).to.be.revertedWith(errors.MIN_REQUIREMENTS_NOT_MET);
      });
    });
  });
});
