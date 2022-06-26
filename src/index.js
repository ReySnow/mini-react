const Zeact = {
    createElement,
    render
}

const TEXT_ELEMENT = 'TEXT_ELEMENT'


function isObject(obj) {
    return typeof obj === 'object'
}

function createElement(type, props, ...children) {
    return {
        type,
        props: {
            ...props,
            children: children.map(item =>
                isObject(item) ? item : createTextElement(item)
            )
        },
    }
}

// 将text转换成element
function createTextElement(text) {
    return {
        type: TEXT_ELEMENT,
        props: {
            nodeValue: text,
            children: []
        }
    }
}

let nextUnitOfWork = null
let wipRoot = null

function render(elemet, container) {
    // 设置下一个工作单元（nextUnitOfWork）
    // 设置 fiber 树的根（root fiber
    wipRoot = {
        dom: container,
        props: {
            children: [elemet]
        }
    }

    nextUnitOfWork = wipRoot
}

function createDom(fiber) {
    const dom =
        fiber.type === TEXT_ELEMENT
            ? document.createTextNode('')
            : document.createElement(fiber.type)

    const isProperty = (key) => key !== 'children'

    Object.keys(fiber.props)
        .filter(isProperty)
        .forEach(name => {
            dom[name] = fiber.props[name]
        })

    return dom
}

function workLoop(deadLine) {
    let shouldYield = false
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        shouldYield = deadLine.timeRemaining() < 1
    }

    // 一旦结束所有工作（因为没有下一个工作单元），便将整个 fiber 树提交给 DOM
    if (!nextUnitOfWork && wipRoot) {
        commitRoot()
    }

    requestIdleCallback(workLoop)
}
// 浏览器在主线程空闲时运行回调
requestIdleCallback(workLoop)

function commitRoot() {
    // 添加节点到root
    commitWork(wipRoot.child)
    wipRoot = null
}

function commitWork(fiber) {
    if (!fiber) {
        return
    }
    const domParent = fiber.parent.dom
    domParent.appendChild(fiber.dom)
    commitWork(fiber.child)
    commitWork(fiber.sibling)
}


/**
 * 对每一个 fiber
 * 1 将 element 添加到 DOM
 * 2 为每个 element 的 children 创建 fiber
 * 3 选择下一个工作单元
 */
function performUnitOfWork(fiber) {
    // 添加 dom 节点
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }
    // if (fiber.parent) {
    //     fiber.parent.dom.appendChild(fiber.dom)
    // }
    // 创建新的fiber
    const elemets = fiber.props.children
    let index = 0
    let prevSibling = null
    while (index < elemets.length) {
        const elemet = elemets[index]
        const newFiber = {
            type: elemet.type,
            props: elemet.props,
            parent: fiber,// 父节点
            dom: null
        }

        // 每一个 fiber 都会链接到自身的第一个子节点、下一个兄弟节点和父节点。
        if (index === 0) {
            fiber.child = newFiber// 第一个子节点
        } else {
            prevSibling.sibling = newFiber// 下一个兄弟节点
        }

        prevSibling = newFiber
        index++
    }
    // 返回 nextUnitOfWork
    // 开始查找下一个工作单元，首先从其子节点开始查找，
    // 然后找其兄弟节点，再找叔叔节点，依此推内。
    // 或者到根节点结束
    if (fiber.child) {
        return fiber.child
    }
    let nextFiber = fiber
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent
    }
}


/**@jsx Zeact.createElement */
const elemet = (
    // eslint-disable-next-line
    <div title="foo" style="background: salmon">
        <h1>bardfg</h1>
        <br />
    </div>
)
// const elemet = Zeact.createElement(
//     'div',
//     { id: 'foo' },
//     Zeact.createElement('a', null, 'bar'),
//     Zeact.createElement('br')
// )

const container = document.getElementById('root')
Zeact.render(elemet, container)
