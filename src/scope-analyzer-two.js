import reduce, { MonoidalReducer } from 'shift-reducer';

import { Declaration, DeclarationType } from './declaration.js';

// todo revisit having these
function func(node, params, body) {
  return {
    type: 'function',
    node,
    params,
    body,
  };
}

function assignment(node, compound, binding, init) {
  return {
    type: 'reference',
    node,
    compound,
    binding,
    init,
  };
}

function assignmentTargetIdentifier(node) {
  return {
    type: 'ati',
    node,
  };
}

function bindingIdentifier(node) {
  return {
    type: 'bi',
    node,
  };
}

function parameterExpressions(wrapped) {
  return {
    type: 'param exprs',
    wrapped,
  };
}

function block(node, wrapped) {
  return {
    type: 'block',
    node,
    wrapped,
  };
}

export default class ScopeAnalyzer extends MonoidalReducer {
  constructor() {
    super({
      empty() {
        return null;
      },
      concat(a, b) {
        throw new RuntimeException('unreachable');
      },
    });

    this.append = (...args) => {
      let real = args.filter(a => a != null);
      if (real.length === 0) {
        return null;
      }
      if (real.length === 1) {
        return real[0];
      }
      return {
        type: 'union',
        values: real,
      };
    };
  }

  static analyze(program) {
    return synthesize(reduce(new ScopeAnalyzer, program));
  }


  reduceArrowExpression(node, { params, body }) {
    return func(node, params, body);
  }

  reduceAssignmentExpression(node, { binding, expression }) {
    return assignment(node, false, binding, expression);
  }

  reduceAssignmentTargetIdentifier(node) {
    return assignmentTargetIdentifier(node);
  }

  reduceBindingIdentifier(node) {
    return bindingIdentifier(node);
  }

  reduceBindingPropertyIdentifier(node, { binding, init }) {
    const s = super.reduceBindingPropertyIdentifier(node, { binding, init });
    if (init) {
      return parameterExpressions(s);
    }
    return s;
  }

  reduceBindingWithDefault(node, { binding, init }) {
    return parameterExpressions(super.reduceBindingWithDefault(node, { binding, init }));
  }

  reduceBlock(node, { statements }) {
    return block(node, statements);
  }

  reduceCallExpression(node, { callee, arguments: _arguments }) {
    const s = super.reduceCallExpression(node, { callee, arguments: _arguments });
    if (node.callee.type === 'IdentifierExpression' && node.callee.name === 'eval') {
      return {
        type: 'eval',
        wrapped: s,
      }
    }
    return s;
  }

  reduceCatchClause(node, { binding, body }) {
    return {
      type: 'catch',
      node,
      binding,
      body,
    };
  }

  reduceClassDeclaration(node, { name, super: _super, elements }) {
    return {
      type: 'class declaration',
      node,
      name,
      super: _super,
      elements,
    };
  }

  reduceClassExpression(node, { name, super: _super, elements }) {
    return {
      type: 'class expression',
      node,
      name,
      super: _super,
      elements,
    };
  }

  reduceCompoundAssignmentExpression(node, { binding, expression }) {
    return assignment(node, true, binding, expression);
  }

  reduceComputedMemberExpression(node, { object, expression }) {
    return parameterExpressions(
      super.reduceComputedMemberExpression(node, { object, expression })
    );
  }

  reduceForInStatement(node, { left, right, body }) {
    return {
      type: 'for-in',
      node,
      left,
      right,
      body,
    };
  }

  reduceForOfStatement(node, { left, right, body }) {
    return {
      type: 'for-of',
      node,
      left,
      right,
      body,
    };
  }

  reduceForStatement(node, { init, test, update, body }) {
    return {
      type: 'for',
      node,
      init,
      test,
      update,
      body,
    };
  }

  reduceFormalParameters(node, { items, rest }) {
    return {
      type: 'parameters',
      node,
      items,
      rest,
    };
  }

  reduceFunctionDeclaration(node, { name, params, body }) {
    return {
      type: 'function decl',
      node,
      name,
      params,
      body,
    };
  }

  reduceFunctionExpression(node, { name, params, body }) {
    return {
      type: 'function expr',
      node,
      name,
      params,
      body,
    };
  }

  reduceGetter(node, { name, body }) {
    return {
      type: 'getter',
      node,
      name,
      body,
    };
  }

  reduceIdentifierExpression(node) {
    return {
      type: 'ie',
      node,
    };
  }

  // we need 'if' so we can check if its consequent/alternate are function declarations for b.3.3
  reduceIfStatement(node, { test, consequent, alternate }) {
    return {
      type: 'ie',
      test,
      consequent,
      alternate,
    };
  }

  reduceImport(node, { moduleSpecifier, defaultBinding, namedImports }) {
    return {
      type: 'import',
      node,
      defaultBinding,
      namedImports,
    };
  }

  reduceMethod(node, { name, params, body }) {
    return {
      type: 'method',
      node,
      params,
      body,
    };
  }

  reduceModule(node, { directives, items }) {
    return {
      type: 'module',
      node,
      items,
    };
  }

  reduceScript(node, { directives, statements }) {
    return {
      type: 'script',
      node,
      directives,
      statements,
    };
  }

  reduceSetter(node, { name, param, body }) {
    return {
      type: 'setter',
      node,
      name,
      param,
      body,
    };
  }

  reduceSwitchStatement(node, { discriminant, cases }) {
    return {
      type: 'switch',
      node,
      discriminant,
      cases,
    };
  }

  reduceSwitchStatementWithDefault(node, { discriminant, preDefaultCases, defaultCase, postDefaultCases }) {
    // todo maybe just spread like a normal person
    const cases = preDefaultCases.concat([defaultCase], postDefaultCases);
    return {
      type: 'switch',
      node,
      discriminant,
      cases,
    };
  }

  reduceUnaryExpression(node, { operand }) {
    if (node.operator === 'delete' && node.operand.type === 'IdentifierExpression') {
      // 'delete x' is a special case.
      return {
        type: 'delete',
        operand,
      };
    }
    return super.reduceUnaryExpression(node, { operand });
  }

  reduceUpdateExpression(node, { operand }) {
    return {
      type: 'update',
      operand,
    };
  }

  reduceVariableDeclaration(node, { declarators }) {
    return {
      type: 'variable declaration',
      node,
      declarators,
    };
  }

  reduceVariableDeclarator(node, { binding, init }) {
    // TODO maybe more logic here, for omitted init?
    return {
      type: 'variable declarator',
      node,
      binding,
      init,
    };
  }

  reduceWithStatement(node, { object, body }) {
    return {
      type: 'with',
      node,
      object,
      body,
    };
  }
}

function isStrict(node) {
  return node.directives.some(d => d.rawValue === 'use strict');
}

// TODO reconsider out parameter
function getBindings(item, out) {
  switch (item.type) {
    case 'union': {
      item.values.forEach(v => getBindings(v, out));
      break;
    }
    case 'bi': {
      out.push(item.node);
      break;
    }
    case 'param exprs': {
      getBindings(item.wrapped, out);
      break;
    }
    // TODO enumerate cases somewhere probably
    case 'function expr':
    case 'ie': {
      break;
    }
    default: {
      throw new Error('unimplemented: getBindings type ' + item.type);
    }
  }
}

function getBlockDecls(items, out) {
  items.forEach(item => {
    // TODO we don't need a switch for this
    switch (item.type) {
      case 'variable declaration': {
        if (item.node.kind === 'const' || item.node.kind === 'let') {
          item.declarators.forEach(d => getBindings(d.binding, out));
        }
        break;
      }
      // TODO enumerate cases somewhere probably
      case 'with':
      case 'block': {
        break;
      }
      default: {
        throw new Error('unimplemented: getBlockDecls type ' + item.type);
      }
    }
  });
}

function synthesize(analysis) {
  let strict = false;

  // map string => [{ through: [multimap string => reference], variable }]
  let namesInScope = new Map;

  let parent = null;

  function visit(item) {
    switch (item.type) {
      case 'script': {
        let oldStrict = strict;
        strict = strict && isStrict(item.node);

        let decls = [];
        getBlockDecls(item.statements, decls);

        console.log(decls);


        strict = oldStrict;
        break;
      }
      default: {
        throw new Error('unimplemented: type ' + item.type);
      }
    }
  }

  visit(analysis);
}
