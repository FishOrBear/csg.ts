import { Vector3D } from "../core/math/Vector3";
import { Vector2D } from "../core/math/Vector2";

// Parse an option from the options object
// If the option is not present, return the default value
export function parseOption(options, optionname, defaultvalue)
{
    let result = defaultvalue;
    if (options && optionname in options)
    {
        result = options[optionname];
    }
    return result;
}

// Parse an option and force into a Vector3D. If a scalar is passed it is converted
// into a vector with equal x,y,z
export function parseOptionAs3DVector(options, optionname, defaultvalue)
{
    let array = parseOption(options, optionname, defaultvalue);
    return Vector3D.Create(array);
}

export function parseOptionAs3DVectorList(options, optionname, defaultvalue)
{
    const result = parseOption(options, optionname, defaultvalue);
    return result.map(res =>
    {
        return Vector3D.Create(res);
    });
}

// Parse an option and force into a Vector2D. If a scalar is passed it is converted
// into a vector with equal x,y
export function parseOptionAs2DVector(options, optionname, defaultvalue)
{
    let result = parseOption(options, optionname, defaultvalue);
    result = new Vector2D(result);
    return result;
}

export function parseOptionAsFloat(options, optionname, defaultvalue)
{
    let result = parseOption(options, optionname, defaultvalue);
    if (typeof result === "string")
    {
        result = Number(result);
    }
    if (isNaN(result) || typeof result !== "number")
    {
        throw new Error("Parameter " + optionname + " should be a number");
    }
    return result;
}

export function parseOptionAsInt(options, optionname, defaultvalue)
{
    let result = parseOption(options, optionname, defaultvalue);
    result = Number(Math.floor(result));
    if (isNaN(result))
    {
        throw new Error("Parameter " + optionname + " should be a number");
    }
    return result;
}

export function parseOptionAsBool(options, optionname, defaultvalue)
{
    let result = parseOption(options, optionname, defaultvalue);
    if (result === "true") result = true;
    else if (result === "false") result = false;
    else if (result === 0) result = false;

    result = !!result;
    return result;
}
