import React from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";

/**
 * The one screen that fits the viewport exactly. It carries no content a user
 * needs to reach by scrolling, so a scrollbar here is pure noise on the first
 * thing they ever see — the column measured ~836px against a 667-844px phone
 * and pushed "Get Started" below the fold.
 *
 * Everything vertical is therefore either a small fixed block or a shrinkable
 * one. The artwork panel is the shrinkable one: it takes `flex-1 min-h-0` and
 * absorbs whatever is left after the header, copy and button, instead of the
 * fixed `h-[360px]` it used to carry.
 *
 * The plant is sized in `vh` for the same reason: as a ligature glyph its size
 * is font-size, so it cannot scale to its parent the way an SVG would, and a
 * fixed 280px would overflow the panel the moment the panel shrank.
 */
const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="flex grow min-h-0 flex-col justify-between bg-white dark:bg-background-dark">
        <div className="flex min-h-0 flex-1 flex-col items-center pt-[clamp(1rem,4vh,2.5rem)] animate-fade-in-up">
          <div className="flex items-center justify-center gap-2 px-4 py-2">
            <span className="material-symbols-outlined text-4xl text-accent">
              account_balance
            </span>
            <span className="text-3xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
              LOPAY
            </span>
          </div>

          <div className="flex w-full min-h-0 flex-1 px-6 py-[clamp(0.75rem,2.5vh,1.5rem)]">
            <div className="welcome-art-panel relative flex w-full min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl bg-linear-to-br from-accent/20 to-primary/20">
              {/* Abstract decorative shapes */}
              <div className="absolute top-10 left-10 w-32 h-32 bg-accent/30 rounded-full blur-2xl"></div>
              <div className="absolute bottom-10 right-10 w-40 h-40 bg-primary/30 rounded-full blur-3xl"></div>
              <span className="material-symbols-outlined welcome-art-glyph absolute text-accent">
                potted_plant
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col px-6 pb-[clamp(1rem,4vh,2.5rem)]">
          <h1 className="text-text-primary-light dark:text-text-primary-dark tracking-tight text-[clamp(1.75rem,4.5vh,2.25rem)] font-extrabold leading-tight text-center pb-3">
            Pay School Fees,
            <br />
            Your Way.
          </h1>
          <p className="text-text-secondary-light dark:text-text-secondary-dark text-[clamp(0.9375rem,2.2vh,1.125rem)] font-medium leading-relaxed text-center pb-[clamp(0.75rem,2.5vh,1.5rem)]">
            Break down tuition into simple weekly or monthly installments.
          </p>

          <button
            onClick={() => navigate("/auth")}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-accent text-white text-lg font-bold shadow-xl shadow-accent/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Get Started
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default WelcomeScreen;
