import type { RsbuildPlugin, TransformContext } from "@rsbuild/core";

export type PluginVfdOptions = {
    isClassComponent: (code: string) => boolean;
};

export function passesPreflight(code: string): boolean {

    return (
        !code.includes("type=style") // Not a style block.
        && !code.includes("type=template") // And not a template block.
        && !code.includes("toNative") // And isn't already wrapped with toNative.
    );
}

export function exportsClassComponent(code: string): boolean {

    // It's tricky to identify as class component with 100% certainty whilst covering all edge cases.
    // A percentage-based 'confidence' system is used to maximise the chances of correctly identifying class components.

    // Percentage value. 50% is the minimum confidence score required to consider the code to be a class component.
    // Anything less than- or equal to 50% essentially has the same ods as a coin-flip, making it unreliable.
    let confidence: number = 0;

    // Contains an import to anything from `vue-facing-decorator`.
    if ((code.match(/from\s+['"]vue-facing-decorator['"]/) ?? []).length > 0) {

        // Adds 40% confidence. It's a good indicator but not a guarantee. (e.g. Type file, helper, util file, etc.)
        confidence += 40;
    }

    // Contains a class that extends Vue
    if ((code.match(/class.*extends\sVue/) ?? []).length > 0) {

        // Adds 40% confidence. However, it's possible (albeit unlikely) that another active library uses the same pattern.
        confidence += 40;
    }
    // Does not extend Vue, but is a class that extends something else.
    else if ((code.match(/class.*extends/) ?? []).length > 0) {

        // Adds 10% confidence. Because of the broad nature of this check, it's not a very strong indicator, but 'in-context' it could tip the scales.
        confidence += 10;
    }

    // Milestone achieved: If checks above are all met, a confidence score of either 80% or <=50% has been reached.
    // If this 80% case is active, it's very likely that the code is a class-style component.
    if (confidence > 50) {

        // Early-return to avoid unnecessary work.
        return true;
    }

    // If the early-return gate doesn't trigger, the coin-flip equilibrium is reached.
    // This is intentional, and I'll explain my reasoning behind this design-choice using an example:
    //   a. Imagine a .vue file, containing an options-style component AND a service class above it.
    //     - The file imports some type from `vue-facing-decorator` to type some variable with, somewhere in the code. (+40% confidence)
    //     - The service class itself extends a base service class. (+10% confidence)
    //     - Below this service class is an options-style component. (export default {...})
    //     This is very-much an edge-case, still; The code would pass the checks above, but should not be considered a class-style component.
    //   b. Now, imagine a .vue file, containing a class-style component.
    //     - The file imports the Component decorator from `vue-facing-decorator`. The parser has probably removed the '@' syntax, but the import should still be there. (+40% confidence)
    //     - The class extends ExampleBaseComponent. (+10% confidence as the else-if arm of the previous check triggers)
    //   This is a valid class-style component, but the confidence score is 50%; Precisely on the edge.

    // More checks follow to tip the scales. These checks are rather ambiguous so they will only add little confidence each.
    // This is enough to tip the scales (e.g. 50% -> 51%), but not enough to instantly guarantee a pass when the confidence score was 40% before the early-return (e.g. 40% -> 41%).
    // Furthermore, this still leaves room for super niche edge-cases to be valid. Say there are 10 checks that all pass (only likely when the code is a class-style component even though the odds are against it), the score would be 40% + 10*1% = 50%.

    // There is a default export for something other than an object literal present.
    //   - TypeScript convention specifies it's best to avoid default-exporting classes (whereas it's common practice in Vue), if present and combined with the fact that the score is already at 50%; it's a pretty good indicator.
    //   - In case of example a, the code would most likely not default-export the service class. When export-defaulting the regular options-style component, it would NOT pass this check. (avoiding a false-positive)
    //   - In case of example b, the code would most likely default-export the class-style component, passing this check. (avoiding a false-negative)
    if ((code.match(/export\sdefault\s(?!\{)/) ?? []).length > 0) {

        confidence += 1;
    }

    // Only one edge-case remains. A situation akin to example a, but with an options-style component that is not exported as an object literal.
    //   import { SomeType } from "vue-facing-decorator"; (+40%)
    //   class ExampleService extends BaseService {...} (+10%)
    //   const exampleComponent = {...};
    //   export default exampleComponent; (Does not export object literal, so +1% as per mitigation above)
    // Resulting confidence score: 51% -> A false-positive.
    // The trick is to block this case, whilst still respecting the mitigation above.

    // If the default export is NOT a class and does NOT start with a capital letter, remove 1%. This is quite a 'hack', but as this check is already deep in edge-case territory, it's a reasonable solution.
    //   - In case of `export default SomeClass;`, the mitigation above adds 1%, moving the confidence to 51%. This check does not trigger. (still passing)
    //   - In case of `export default { ... };`, the mitigation above adds nothing, this check removes 1%, moving the confidence down to 49%. (still failing, as it did before as well)
    //   - In case of `export default exampleComponent;` (example above, where `exampleComponent` is a const), the mitigation above adds 1% (-> 51%). But this check removes 1%, moving the confidence down and avoiding a false-positive.
    // Defining classes without starting with a capital letter goes against convention. When deciding to do so, there would be a false-negative, but that's an acceptable risk.
    if ((code.match(/export\sdefault\s(?!class)(?![A-Z])/) ?? []).length > 0) {

        confidence -= 1;
    }

    // Return final verdict. (Estimated 99.98% accuracy)
    return confidence > 50;
}

export function pluginVfd(
    options: PluginVfdOptions = {
        // Default implementation.
        isClassComponent: (code: string): boolean => (
            passesPreflight(code)
            && exportsClassComponent(code)
        )
    }
): RsbuildPlugin {

    return {
        name: "plugin-vfd",

        setup(api) {

            api.transform(
                // Configure handler to apply transformation to Vue files after the Vue loader has processed said file.
                {
                    test: /\.vue$/,
                    enforce: "post"
                },
                // Handler
                ({ code }: TransformContext): string => {

                    // 1. Skip if the file doesn't contain a class-style component that needs to be transformed.
                    if (!options.isClassComponent(code)) {

                        return code;
                    }

                    // 2. Add the toNative import at the top.
                    const vueFacingImport = '\nimport {toNative} from "vue-facing-decorator";\n';

                    // 3. Alter the _sfc_main export, generated by the Vue loader, so it passes it's contents through toNative first.
                    const transformedCode = code.replace(
                        /const _sfc_main = ([A-Za-z]*);/ig,
                        "const _sfc_main = toNative($1);"
                    );

                    // 4. Return the transformed code.
                    return vueFacingImport + transformedCode;
                }
            );
        }
    };
}
